import { logger } from '../utils/logger';

export interface SimulatedOrder {
  id: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  createdAt: number;
  filledSize?: number;
  filledPrice?: number;
  status: 'OPEN' | 'FILLED' | 'CANCELLED' | 'PARTIALLY_FILLED';
}

export interface PaperTradingAccount {
  balance: number;
  positions: Map<string, number>;
  orders: Map<string, SimulatedOrder>;
  trades: number;
  totalVolume: number;
  totalPnL: number;
}

export class PaperTradingSimulator {
  private account: PaperTradingAccount;
  private fillProbability: number = 0.7; // 70% chance orders fill
  private fillDelayMs: number = 100; // Simulate 100ms fill delay

  constructor(initialBalance: number = 100000) {
    this.account = {
      balance: initialBalance,
      positions: new Map(),
      orders: new Map(),
      trades: 0,
      totalVolume: 0,
      totalPnL: 0,
    };

    logger.info(`Paper trading simulator initialized with balance: $${initialBalance}`);
  }

  /**
   * Place a simulated order
   */
  async placeOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: number,
    size: number
  ): Promise<{ id: string } | null> {
    try {
      const orderId = `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Validate balance for BUY orders
      const cost = price * size;
      if (side === 'BUY' && cost > this.account.balance) {
        logger.warn(`Paper trading: Insufficient balance for order. Have: $${this.account.balance}, Need: $${cost}`);
        return null;
      }

      const order: SimulatedOrder = {
        id: orderId,
        tokenId,
        side,
        price,
        size,
        createdAt: Date.now(),
        status: 'OPEN',
      };

      this.account.orders.set(orderId, order);
      logger.info(`Paper trading: Order placed ${orderId} - ${side} ${size} @ ${price}`);

      // Simulate order fill after delay
      setTimeout(() => this.simulateFill(orderId, tokenId, side, price, size), this.fillDelayMs);

      return { id: orderId };
    } catch (error: any) {
      logger.error(`Failed to place paper trading order`, { error: error.message });
      return null;
    }
  }

  /**
   * Simulate order fill
   */
  private simulateFill(orderId: string, tokenId: string, side: 'BUY' | 'SELL', price: number, size: number): void {
    const order = this.account.orders.get(orderId);
    if (!order) return;

    // Randomly decide if order fills
    if (Math.random() > this.fillProbability) {
      order.status = 'CANCELLED';
      logger.debug(`Paper trading: Order cancelled (simulated) ${orderId}`);
      return;
    }

    // Fill the order
    const cost = price * size;

    if (side === 'BUY') {
      this.account.balance -= cost;
      const currentPosition = this.account.positions.get(tokenId) || 0;
      this.account.positions.set(tokenId, currentPosition + size);
    } else {
      this.account.balance += cost;
      const currentPosition = this.account.positions.get(tokenId) || 0;
      this.account.positions.set(tokenId, Math.max(0, currentPosition - size));
    }

    order.status = 'FILLED';
    order.filledSize = size;
    order.filledPrice = price;
    this.account.trades++;
    this.account.totalVolume += size;

    logger.info(`Paper trading: Order filled ${orderId} - ${side} ${size} @ ${price}`);
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    const order = this.account.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'OPEN') {
      order.status = 'CANCELLED';
      logger.info(`Paper trading: Order cancelled ${orderId}`);
      return true;
    }

    return false;
  }

  /**
   * Get account balance
   */
  getBalance(): number {
    return this.account.balance;
  }

  /**
   * Get position for a token
   */
  getPosition(tokenId: string): number {
    return this.account.positions.get(tokenId) || 0;
  }

  /**
   * Get all positions
   */
  getAllPositions(): Record<string, number> {
    const positions: Record<string, number> = {};
    for (const [tokenId, size] of this.account.positions.entries()) {
      if (size > 0) positions[tokenId] = size;
    }
    return positions;
  }

  /**
   * Get account summary
   */
  getAccountSummary(): {
    balance: number;
    totalTrades: number;
    totalVolume: number;
    totalPnL: number;
    positions: Record<string, number>;
    openOrders: number;
  } {
    const openOrders = Array.from(this.account.orders.values()).filter((o) => o.status === 'OPEN').length;

    return {
      balance: this.account.balance,
      totalTrades: this.account.trades,
      totalVolume: this.account.totalVolume,
      totalPnL: this.account.totalPnL,
      positions: this.getAllPositions(),
      openOrders,
    };
  }

  /**
   * Get order details
   */
  getOrder(orderId: string): SimulatedOrder | undefined {
    return this.account.orders.get(orderId);
  }

  /**
   * Get all open orders
   */
  getOpenOrders(): SimulatedOrder[] {
    return Array.from(this.account.orders.values()).filter((o) => o.status === 'OPEN');
  }

  /**
   * Set fill probability (for testing different market conditions)
   */
  setFillProbability(probability: number): void {
    this.fillProbability = Math.max(0, Math.min(1, probability));
  }

  /**
   * Set fill delay (for testing different response times)
   */
  setFillDelayMs(delayMs: number): void {
    this.fillDelayMs = Math.max(0, delayMs);
  }

  /**
   * Reset simulator
   */
  reset(initialBalance: number = 100000): void {
    this.account = {
      balance: initialBalance,
      positions: new Map(),
      orders: new Map(),
      trades: 0,
      totalVolume: 0,
      totalPnL: 0,
    };
    logger.info(`Paper trading simulator reset with balance: $${initialBalance}`);
  }
}

// Export singleton instance
export const paperTradingSimulator = new PaperTradingSimulator();
