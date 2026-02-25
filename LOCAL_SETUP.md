# Local Market Maker Bot Setup Guide

This guide will help you set up and run the Polymarket Market Maker Bot locally with Excel trade logging enabled.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Polymarket API credentials
- Ethereum wallet (for Polymarket)

## Installation

### 1. Clone and Install Dependencies

```bash
cd /home/user/Market_Maker
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

## Configuration

### 1. Create `.env` File

Create a `.env` file in the root directory with your Polymarket credentials:

```env
# Polymarket API Configuration
POLYMARKET_API_KEY=your_api_key_here
POLYMARKET_PRIVATE_KEY=your_private_key_here
POLYMARKET_WALLET_ADDRESS=your_wallet_address_here

# API Server Configuration
API_PORT=3000
API_HOST=localhost

# Market Making Strategy
DEFAULT_SPREAD_BPS=50
DEFAULT_ORDER_SIZE_USD=100
MAX_POSITION_SIZE_USD=10000
MAX_INVENTORY_IMBALANCE=0.5

# Risk Management
ENABLE_RISK_LIMITS=true
MAX_TOTAL_EXPOSURE_USD=50000

# Order Refresh Interval (milliseconds)
ORDER_REFRESH_INTERVAL_MS=30000
```

### 2. Review Configuration Files

- `src/config.ts` - Main configuration settings
- `SETUP.md` - Original setup documentation
- `IMPLEMENTATION_NOTES.md` - Implementation details

## Running the Bot

### Development Mode (with hot reload)

```bash
npm run dev
```

This will start the bot with TypeScript transpilation and auto-restart on file changes.

### Production Mode

```bash
npm run build
npm start
```

## Trade Logging and Analysis

### Automatic Trade Logging

All trades placed by the bot are automatically logged to Excel files in the `./trades` directory:

- **File naming**: `trades_YYYY-MM-DD.xlsx`
- **Location**: `./trades/` directory
- **Format**: Detailed spreadsheet with the following columns:
  - Timestamp
  - Market ID
  - Market Question
  - Token ID
  - Outcome (YES/NO)
  - Side (BUY/SELL)
  - Price
  - Size
  - Order ID
  - Status (PLACED/FILLED/CANCELLED/FAILED)
  - Filled Size (when filled)
  - Filled Price (when filled)
  - P&L (when available)

### Accessing Trades via API

Get trade summary:

```bash
curl http://localhost:3000/api/status
```

This will show:
- Active markets
- Total trades placed
- Current positions
- Risk metrics

### Manual Trade Analysis

Excel files are created daily. You can:

1. **Open the Excel files** directly from the `./trades/` directory
2. **Use built-in Excel features** for:
   - Pivot tables for analysis
   - Charts for visualization
   - Formulas for profitability calculations
3. **Export data** for further analysis in Python, R, or other tools

## Profitability Analysis

### Key Metrics to Track

1. **Win Rate**: % of profitable trades
2. **Average Trade Size**: Mean order size in USD
3. **Spread Capture**: Average spread earned per trade
4. **Total Volume**: Total USD volume traded
5. **P&L by Market**: Performance per market
6. **P&L by Outcome**: Performance on YES vs NO

### Excel Analysis Example

Create a pivot table to analyze:

```
Rows: Outcome, Side
Values: Sum of (Price * Size)
Filters: Status, Date
```

## API Endpoints

### Get Status

```bash
GET /api/status
```

Response:
```json
{
  "running": true,
  "activeMarkets": 2,
  "markets": [
    {
      "marketId": "0x123...",
      "question": "Will X happen?",
      "orders": 4,
      "lastUpdate": 1708900000000
    }
  ]
}
```

### Start Market Making

```bash
POST /api/markets/start
Content-Type: application/json

{
  "marketId": "0x123...",
  "config": {
    "spreadBps": 50,
    "orderSizeUsd": 100,
    "maxPositionSizeUsd": 10000
  }
}
```

### Stop Market Making

```bash
POST /api/markets/stop
Content-Type: application/json

{
  "marketId": "0x123..."
}
```

### Get All Markets

```bash
GET /api/markets
```

## Troubleshooting

### Bot Not Trading

1. Check API credentials in `.env`
2. Verify wallet has sufficient balance
3. Check logs: `npm run dev` shows real-time logs
4. Ensure market IDs are correct

### No Excel Files Created

1. Check `./trades` directory exists
2. Look for errors in console output
3. Verify file permissions in current directory
4. Check disk space availability

### Excel Files Not Updating

1. Bot may not have active markets
2. Check status endpoint: `GET /api/status`
3. Ensure risk limits aren't preventing trading
4. Review logs for errors

### Permission Errors

If you see permission errors:

```bash
# Make sure the trades directory is writable
chmod 755 ./trades
```

## Performance Optimization

### Tips for Profitability

1. **Adjust spread**: Start with 50 bps, optimize based on results
2. **Monitor inventory**: Keep balanced positions to avoid risk limits
3. **Review daily Excel**: Analyze which markets are most profitable
4. **Risk management**: Don't increase position sizes too quickly

### Monitoring Strategy

1. Run bot for 1 week
2. Export and analyze Excel data
3. Identify profitable market segments
4. Focus capital on best-performing markets
5. Re-optimize spread and order sizes

## Directory Structure

```
Market_Maker/
├── src/
│   ├── clients/          # API clients
│   ├── services/         # Bot logic
│   ├── routes/          # API endpoints
│   ├── utils/           # Utilities (includes tradeLogger.ts)
│   ├── types/           # TypeScript types
│   ├── config.ts        # Configuration
│   └── index.ts         # Entry point
├── dist/                # Compiled JavaScript
├── trades/              # Excel trade logs (auto-created)
├── .env                 # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Stopping the Bot

Press `Ctrl+C` to stop the bot gracefully. The bot will:
1. Cancel all active orders
2. Save any pending trades to Excel
3. Close all connections
4. Exit cleanly

## Next Steps

1. Configure your API credentials
2. Run in dev mode: `npm run dev`
3. Start market making on a market
4. Monitor the Excel files daily
5. Analyze profitability and optimize parameters

## Support

For issues or questions, check:
- Original repository: https://github.com/gigi0500/polymarket-market-maker-bot
- `PROJECT_SUMMARY.md` - Project overview
- `IMPLEMENTATION_NOTES.md` - Technical details
