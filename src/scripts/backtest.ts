/**
 * Backtest runner - simulates market making against live orderbook data.
 *
 * Usage:
 *   npm run backtest
 *
 * This script:
 *   1. Fetches real orderbook data from Polymarket (public, no auth needed)
 *   2. Runs the market-making strategy in paper-trading mode
 *   3. Simulates order fills over N rounds
 *   4. Prints a P&L summary at the end
 *   5. Saves all trades to an Excel file in ./trades/
 *
 * Environment variables (optional):
 *   BACKTEST_MARKET_ID   - Polymarket market ID to test (prompted if missing)
 *   BACKTEST_ROUNDS      - Number of quote-refresh rounds (default: 50)
 *   BACKTEST_INTERVAL_MS - Delay between rounds in ms (default: 2000)
 */

import dotenv from 'dotenv';
dotenv.config();

// Force paper trading on for backtests
process.env.PAPER_TRADING = 'true';
if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === '0xYOUR_PRIVATE_KEY_HERE') {
  // Use a throwaway key so the config validator doesn't crash
  process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
}

import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { tradeLogger } from '../utils/tradeLogger';
import { PaperTradingSimulator } from '../services/paperTradingSimulator';
import { Orderbook, Market } from '../types';

// ── Helpers ─────────────────────────────────────────────

const gammaApi = axios.create({
  baseURL: config.polymarket.gammaEndpoint,
  timeout: 30000,
});

const clobApi = axios.create({
  baseURL: config.polymarket.clobEndpoint,
  timeout: 30000,
});

async function fetchMarket(marketId: string): Promise<Market | null> {
  try {
    const resp = await gammaApi.get('/markets', { params: { ids: marketId } });
    const markets = Array.isArray(resp.data) ? resp.data : [resp.data];
    const m = markets.find((x: any) => x.id === marketId || x.id === parseInt(marketId));
    if (!m) return null;

    let tokenIds: string[] = [];
    if (m.clobTokenIds) {
      tokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds;
    }

    return {
      id: m.id?.toString() || marketId,
      question: m.question || m.title || '',
      slug: m.slug || '',
      conditionId: m.conditionId || '',
      clobTokenIds: tokenIds,
      active: m.active === true,
      closed: m.closed === true,
      outcomes: m.outcomes || [],
    };
  } catch (err: any) {
    logger.error(`Failed to fetch market ${marketId}: ${err.message}`);
    return null;
  }
}

async function fetchOrderbook(tokenId: string): Promise<Orderbook | null> {
  try {
    const resp = await clobApi.get('/book', { params: { token_id: tokenId } });
    return resp.data;
  } catch (err: any) {
    logger.error(`Failed to fetch orderbook for ${tokenId}: ${err.message}`);
    return null;
  }
}

function midPrice(book: Orderbook): number | null {
  const bestBid = book.bids?.[0]?.price ? parseFloat(book.bids[0].price) : null;
  const bestAsk = book.asks?.[0]?.price ? parseFloat(book.asks[0].price) : null;
  if (bestBid !== null && bestAsk !== null) return (bestBid + bestAsk) / 2;
  return bestBid ?? bestAsk ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main backtest loop ──────────────────────────────────

async function runBacktest() {
  const marketId = process.env.BACKTEST_MARKET_ID || process.argv[2];
  const rounds = parseInt(process.env.BACKTEST_ROUNDS || '50', 10);
  const intervalMs = parseInt(process.env.BACKTEST_INTERVAL_MS || '2000', 10);
  const spreadBps = config.strategy.defaultSpreadBps;
  const orderSizeUsd = config.strategy.defaultOrderSizeUsd;

  if (!marketId) {
    console.log('');
    console.log('============================================================');
    console.log(' Polymarket Market Maker - Backtester');
    console.log('============================================================');
    console.log('');
    console.log('Usage:');
    console.log('  npm run backtest -- <MARKET_ID>');
    console.log('');
    console.log('Or set BACKTEST_MARKET_ID in your .env');
    console.log('');
    console.log('To find a market ID:');
    console.log('  1. Go to https://polymarket.com');
    console.log('  2. Open a market');
    console.log('  3. The numeric ID is in the URL or page source');
    console.log('  4. Or query: https://gamma-api.polymarket.com/markets?closed=false&limit=5');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('============================================================');
  console.log(' Polymarket Market Maker - Backtester');
  console.log('============================================================');
  console.log(`  Market ID:     ${marketId}`);
  console.log(`  Rounds:        ${rounds}`);
  console.log(`  Interval:      ${intervalMs}ms`);
  console.log(`  Spread:        ${spreadBps} bps`);
  console.log(`  Order size:    $${orderSizeUsd}`);
  console.log(`  Initial cash:  $${config.paperTrading.initialBalance}`);
  console.log('============================================================');
  console.log('');

  // 1. Fetch market
  console.log('Fetching market info...');
  const market = await fetchMarket(marketId);
  if (!market) {
    console.error(`Market ${marketId} not found. Check the ID and try again.`);
    process.exit(1);
  }
  if (market.clobTokenIds.length < 2) {
    console.error('Market does not have YES/NO tokens.');
    process.exit(1);
  }

  const yesToken = market.clobTokenIds[0];
  const noToken = market.clobTokenIds[1];

  console.log(`  Question: ${market.question}`);
  console.log(`  YES token: ${yesToken.slice(0, 16)}...`);
  console.log(`  NO  token: ${noToken.slice(0, 16)}...`);
  console.log('');

  // 2. Set up paper trading simulator
  const sim = new PaperTradingSimulator(config.paperTrading.initialBalance);
  const startBalance = sim.getBalance();
  let filledTrades = 0;

  // 3. Run rounds
  for (let round = 1; round <= rounds; round++) {
    const yesBook = await fetchOrderbook(yesToken);
    const noBook = await fetchOrderbook(noToken);

    if (!yesBook || !noBook) {
      console.log(`  [Round ${round}/${rounds}] Orderbook unavailable, skipping...`);
      await sleep(intervalMs);
      continue;
    }

    const yesMid = midPrice(yesBook);
    const noMid = midPrice(noBook);

    if (yesMid === null || noMid === null) {
      console.log(`  [Round ${round}/${rounds}] No midprice available, skipping...`);
      await sleep(intervalMs);
      continue;
    }

    const spread = (yesMid * spreadBps) / 10000;
    const yesBid = yesMid - spread / 2;
    const yesAsk = yesMid + spread / 2;
    const noBid = noMid - spread / 2;
    const noAsk = noMid + spread / 2;

    const sizeTokens = orderSizeUsd / yesMid;

    // Place 4 orders: buy/sell on YES, buy/sell on NO
    const orders = [
      { tokenId: yesToken, side: 'BUY' as const, price: yesBid, size: sizeTokens, outcome: 'YES' as const },
      { tokenId: yesToken, side: 'SELL' as const, price: yesAsk, size: sizeTokens, outcome: 'YES' as const },
      { tokenId: noToken, side: 'BUY' as const, price: noBid, size: sizeTokens, outcome: 'NO' as const },
      { tokenId: noToken, side: 'SELL' as const, price: noAsk, size: sizeTokens, outcome: 'NO' as const },
    ];

    let roundFills = 0;
    for (const o of orders) {
      const result = await sim.placeOrder(o.tokenId, o.side, o.price, o.size);
      if (result) {
        // Wait for fill simulation
        await sleep(150);
        const order = sim.getOrder(result.id);
        if (order && order.status === 'FILLED') {
          roundFills++;
          filledTrades++;
          tradeLogger.logTrade({
            timestamp: new Date().toISOString(),
            marketId,
            marketQuestion: market.question,
            tokenId: o.tokenId,
            outcome: o.outcome,
            side: o.side,
            price: o.price,
            size: o.size,
            orderId: result.id,
            status: 'FILLED',
            filledSize: order.filledSize,
            filledPrice: order.filledPrice,
          });
        }
      }
    }

    const bal = sim.getBalance();
    const pnl = bal - startBalance;
    const pnlSign = pnl >= 0 ? '+' : '';

    console.log(
      `  [Round ${round}/${rounds}] ` +
      `YES mid=${yesMid.toFixed(4)} | NO mid=${noMid.toFixed(4)} | ` +
      `Fills=${roundFills}/4 | Balance=$${bal.toFixed(2)} (${pnlSign}${pnl.toFixed(2)})`
    );

    if (round < rounds) {
      await sleep(intervalMs);
    }
  }

  // 4. Print summary
  const summary = sim.getAccountSummary();
  const finalPnl = summary.balance - startBalance;

  console.log('');
  console.log('============================================================');
  console.log(' BACKTEST RESULTS');
  console.log('============================================================');
  console.log(`  Market:          ${market.question}`);
  console.log(`  Rounds:          ${rounds}`);
  console.log(`  Starting balance: $${startBalance.toFixed(2)}`);
  console.log(`  Final balance:    $${summary.balance.toFixed(2)}`);
  console.log(`  P&L:              ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}`);
  console.log(`  Total fills:      ${filledTrades}`);
  console.log(`  Total volume:     ${summary.totalVolume.toFixed(2)} tokens`);
  console.log(`  Open orders:      ${summary.openOrders}`);

  const posEntries = Object.entries(summary.positions);
  if (posEntries.length > 0) {
    console.log('  Remaining positions:');
    for (const [tokenId, size] of posEntries) {
      const label = tokenId === yesToken ? 'YES' : tokenId === noToken ? 'NO' : tokenId.slice(0, 12);
      console.log(`    ${label}: ${size.toFixed(4)} tokens`);
    }
  }
  console.log('============================================================');

  // Save trade log
  await tradeLogger.saveToExcel();
  console.log('');
  console.log('Trade log saved to ./trades/ directory');
}

runBacktest().catch((err) => {
  console.error('Backtest failed:', err.message || err);
  process.exit(1);
});
