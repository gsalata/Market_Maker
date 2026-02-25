import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { logger } from './logger';

export interface TradeRecord {
  timestamp: string;
  marketId: string;
  marketQuestion: string;
  tokenId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  orderId: string;
  status: 'PLACED' | 'FILLED' | 'CANCELLED' | 'FAILED';
  filledSize?: number;
  filledPrice?: number;
  pnl?: number;
}

export class TradeLogger {
  private tradesDir: string;
  private trades: Map<string, TradeRecord[]> = new Map();

  constructor(tradesDir: string = './trades') {
    this.tradesDir = tradesDir;
    this.ensureTradesDirectory();
  }

  /**
   * Ensure trades directory exists
   */
  private ensureTradesDirectory(): void {
    if (!fs.existsSync(this.tradesDir)) {
      fs.mkdirSync(this.tradesDir, { recursive: true });
      logger.info(`Created trades directory at ${this.tradesDir}`);
    }
  }

  /**
   * Log a trade
   */
  logTrade(record: TradeRecord): void {
    const date = new Date(record.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!this.trades.has(dateStr)) {
      this.trades.set(dateStr, []);
    }

    this.trades.get(dateStr)!.push(record);
    logger.debug(`Trade logged: ${record.marketId} - ${record.side} ${record.size} at ${record.price}`);
  }

  /**
   * Update trade status and details
   */
  updateTrade(
    marketId: string,
    orderId: string,
    updates: Partial<TradeRecord>
  ): void {
    for (const trades of this.trades.values()) {
      const trade = trades.find((t) => t.marketId === marketId && t.orderId === orderId);
      if (trade) {
        Object.assign(trade, updates);
        logger.debug(`Trade updated: ${orderId} - ${updates.status}`);
        break;
      }
    }
  }

  /**
   * Save all trades to Excel files
   */
  async saveToExcel(): Promise<void> {
    try {
      for (const [dateStr, trades] of this.trades.entries()) {
        if (trades.length === 0) {
          continue;
        }

        const filename = `trades_${dateStr}.xlsx`;
        const filepath = path.join(this.tradesDir, filename);

        // Prepare data for Excel
        const worksheetData = trades.map((trade) => ({
          Timestamp: trade.timestamp,
          'Market ID': trade.marketId,
          'Market Question': trade.marketQuestion,
          'Token ID': trade.tokenId,
          Outcome: trade.outcome,
          Side: trade.side,
          Price: parseFloat(trade.price.toString()).toFixed(6),
          Size: parseFloat(trade.size.toString()).toFixed(6),
          'Order ID': trade.orderId,
          Status: trade.status,
          'Filled Size': trade.filledSize ? parseFloat(trade.filledSize.toString()).toFixed(6) : '',
          'Filled Price': trade.filledPrice ? parseFloat(trade.filledPrice.toString()).toFixed(6) : '',
          PnL: trade.pnl ? parseFloat(trade.pnl.toString()).toFixed(8) : '',
        }));

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(worksheetData);

        // Set column widths
        const colWidths = [
          { wch: 25 }, // Timestamp
          { wch: 15 }, // Market ID
          { wch: 40 }, // Market Question
          { wch: 15 }, // Token ID
          { wch: 10 }, // Outcome
          { wch: 8 },  // Side
          { wch: 12 }, // Price
          { wch: 12 }, // Size
          { wch: 15 }, // Order ID
          { wch: 12 }, // Status
          { wch: 12 }, // Filled Size
          { wch: 12 }, // Filled Price
          { wch: 12 }, // PnL
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Trades');

        // Write file
        XLSX.writeFile(wb, filepath);
        logger.info(`Trades saved to ${filepath}`);
      }
    } catch (error: any) {
      logger.error(`Failed to save trades to Excel`, {
        error: error.message,
      });
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTrades: number;
    totalBuys: number;
    totalSells: number;
    totalVolume: number;
    avgPrice: number;
    totalPnL: number;
  } {
    let totalTrades = 0;
    let totalBuys = 0;
    let totalSells = 0;
    let totalVolume = 0;
    let totalCost = 0;
    let totalPnL = 0;

    for (const trades of this.trades.values()) {
      for (const trade of trades) {
        totalTrades++;
        totalVolume += trade.size;
        totalCost += trade.price * trade.size;

        if (trade.side === 'BUY') {
          totalBuys++;
        } else {
          totalSells++;
        }

        if (trade.pnl) {
          totalPnL += trade.pnl;
        }
      }
    }

    const avgPrice = totalVolume > 0 ? totalCost / totalVolume : 0;

    return {
      totalTrades,
      totalBuys,
      totalSells,
      totalVolume,
      avgPrice,
      totalPnL,
    };
  }

  /**
   * Get market summary by market ID
   */
  getMarketSummary(marketId: string): {
    market: string;
    totalTrades: number;
    totalVolume: number;
    totalPnL: number;
    yesBuys: number;
    yesSells: number;
    noBuys: number;
    noSells: number;
  } {
    let totalTrades = 0;
    let totalVolume = 0;
    let totalPnL = 0;
    let yesBuys = 0;
    let yesSells = 0;
    let noBuys = 0;
    let noSells = 0;
    let market = '';

    for (const trades of this.trades.values()) {
      for (const trade of trades) {
        if (trade.marketId === marketId) {
          totalTrades++;
          totalVolume += trade.size;
          market = trade.marketQuestion;

          if (trade.pnl) {
            totalPnL += trade.pnl;
          }

          if (trade.outcome === 'YES' && trade.side === 'BUY') yesBuys++;
          else if (trade.outcome === 'YES' && trade.side === 'SELL') yesSells++;
          else if (trade.outcome === 'NO' && trade.side === 'BUY') noBuys++;
          else if (trade.outcome === 'NO' && trade.side === 'SELL') noSells++;
        }
      }
    }

    return {
      market,
      totalTrades,
      totalVolume,
      totalPnL,
      yesBuys,
      yesSells,
      noBuys,
      noSells,
    };
  }
}

export const tradeLogger = new TradeLogger();
