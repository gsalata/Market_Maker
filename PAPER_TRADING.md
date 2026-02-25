# Paper Trading Mode Guide

Paper trading mode allows you to test the market maker bot with simulated trades without risking real money. All trades are logged to Excel for analysis, just like live trading.

## Quick Start

### 1. Create `.env` File for Paper Trading

```bash
# Paper Trading Configuration
PAPER_TRADING=true
PAPER_TRADING_BALANCE=100000

# Optional: Any dummy credentials work for paper trading
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234

# API Server
PORT=3000
NODE_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Paper Trading Mode

```bash
npm run dev
```

You should see:
```
Paper trading simulator initialized with balance: $100000
Starting Polymarket Market Maker Bot...
Server running on port 3000
```

## How Paper Trading Works

### Order Simulation
- **70% fill probability**: Orders have a 70% chance to fill (simulating real market conditions)
- **100ms fill delay**: Simulated order fills after 100ms (realistic latency)
- **Balance validation**: Can't place orders larger than available balance
- **Position tracking**: Maintains accurate inventory positions

### Trade Logging
- All simulated trades are logged to Excel files in `./trades/` directory
- Files named: `trades_YYYY-MM-DD.xlsx`
- Includes: timestamp, price, size, side, order status
- Perfect for backtesting strategy profitability

### Account Management
- Initial balance: Set via `PAPER_TRADING_BALANCE` env var (default: $100,000)
- Current balance: Decreases with BUY orders, increases with SELL orders
- Positions: Tracked per token (YES/NO outcomes)
- P&L: Calculated and logged with each trade

## API Endpoints (Same as Live Trading)

### Get Account Status

```bash
curl http://localhost:3000/api/status
```

Response includes:
- Account balance
- Open orders
- Current positions
- Total trades and volume

### Start Market Making on a Market

```bash
curl -X POST http://localhost:3000/api/markets/start \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "0x123...",
    "config": {
      "spreadBps": 50,
      "orderSizeUsd": 100,
      "maxPositionSizeUsd": 10000
    }
  }'
```

### View Excel Trades

All trades are automatically saved to `./trades/trades_YYYY-MM-DD.xlsx`

Open directly to see:
- Timestamp
- Market question
- YES/NO outcome
- BUY/SELL side
- Price and size
- Order status
- P&L when available

## Configuration Options

### Paper Trading Settings

```env
# Enable paper trading (true/false)
PAPER_TRADING=true

# Starting account balance in USD
PAPER_TRADING_BALANCE=100000

# Market Making Strategy
DEFAULT_SPREAD_BPS=50              # Basis points spread
DEFAULT_ORDER_SIZE_USD=100         # Size per order
MAX_POSITION_SIZE_USD=10000        # Max position per market
MAX_INVENTORY_IMBALANCE=0.5        # Inventory rebalance trigger

# Risk Limits
ENABLE_RISK_LIMITS=true
MAX_TOTAL_EXPOSURE_USD=50000       # Total capital at risk
MAX_POSITION_PER_MARKET_USD=10000  # Max per market
```

## Workflow Examples

### Example 1: Test Profitability on Single Market

1. Set `PAPER_TRADING=true` in `.env`
2. Start bot: `npm run dev`
3. Start market making on one market via API
4. Let it run for 1 hour
5. Stop with Ctrl+C
6. Open `./trades/trades_TODAY.xlsx`
7. Analyze wins/losses and spread captured

### Example 2: Backtest Different Spreads

```bash
# Test 1: 50 bps spread
DEFAULT_SPREAD_BPS=50 npm run dev
# Run for 30 minutes, check trades

# Test 2: 100 bps spread
DEFAULT_SPREAD_BPS=100 npm run dev
# Run for 30 minutes, check trades

# Compare Excel files for which spread is most profitable
```

### Example 3: Test Risk Management

```bash
# Conservative
MAX_POSITION_SIZE_USD=1000
MAX_TOTAL_EXPOSURE_USD=10000

# Run bot, observe if risk limits prevent over-exposure
# Check Excel for position management effectiveness
```

## Analyzing Paper Trading Results

### Key Metrics in Excel

1. **Win Rate**: Count profitable trades / total trades
2. **Average Spread**: Average price difference between BUY and SELL
3. **Daily P&L**: Sum of all P&L column for the day
4. **Volume**: Sum of Size column
5. **Fill Rate**: Filled orders / total placed orders

### Example Excel Analysis

```
Rows: Side (BUY/SELL)
Columns: Count, Sum(Size), Average(Price)
Filter: Status = FILLED

This shows avg prices and volumes by side
```

### Create Pivot Table for Analysis

1. Open Excel file
2. Select all data
3. Insert → Pivot Table
4. Rows: Outcome, Columns: Side
5. Values: Sum(Size), Count(Orders)
6. Shows: Which outcomes/sides are most profitable

## Troubleshooting

### Bot Not Starting

```
Error: PRIVATE_KEY environment variable is required
```

**Solution**: Paper trading requires a dummy private key:
```env
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234
PAPER_TRADING=true
```

### Excel Files Not Created

1. Check `./trades/` directory exists (created automatically)
2. Check file permissions: `ls -la ./trades/`
3. Check for errors in console output
4. Ensure bot is actually placing orders

### Orders Not Filling

Paper trading has 70% fill probability. If orders aren't filling:
- Run longer to see more fills
- Check console for order placement messages
- Verify balance is sufficient

### Balance Too Low

If balance runs out:
1. Stop the bot (Ctrl+C)
2. Increase `PAPER_TRADING_BALANCE` in `.env`
3. Restart with `npm run dev`

## Comparing to Live Trading

| Aspect | Paper Trading | Live Trading |
|--------|--------------|--------------|
| Real money at risk | No | Yes |
| Realistic fills | Simulated (70%) | Real |
| Slippage | Fixed | Variable |
| Market impact | Not modeled | Real |
| API credentials | Optional | Required |
| Trade logging | Yes | Yes |
| Order latency | 100ms simulated | Real |
| P&L tracking | Simulated | Real |

## Next Steps

1. **Test Strategy**: Run paper trading for a few hours
2. **Analyze Results**: Check Excel files for profitability
3. **Optimize Parameters**: Adjust spreads, sizes, risk limits
4. **Validate Logic**: Ensure orders and risk management work as expected
5. **Go Live**: Switch to real trading once confident

## Tips for Effective Paper Trading

1. **Run for at least 1 hour** to get enough trades for analysis
2. **Test multiple markets** to see which are most profitable
3. **Vary one parameter at a time** to identify best settings
4. **Review Excel daily** to identify patterns
5. **Simulate different market conditions** by adjusting spreads
6. **Check fill rates** - if too many orders cancel, increase spread

## Support

For issues with paper trading:
1. Check console logs for error messages
2. Verify `.env` file configuration
3. Ensure bot can access market data (uses real Polymarket API)
4. Review Excel files to understand trade patterns
