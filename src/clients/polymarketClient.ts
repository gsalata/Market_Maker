import { ClobClient, ApiKeyCreds, Side, OrderType } from '@polymarket/clob-client';
import axios, { AxiosInstance } from 'axios';
import { Wallet } from '@ethersproject/wallet';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Orderbook, Market, Position, Order } from '../types';

export class PolymarketClient {
  private clobClient!: ClobClient;
  private gammaClient: AxiosInstance;
  private dataClient: AxiosInstance;
  private wallet: Wallet;

  constructor() {
    this.gammaClient = axios.create({
      baseURL: config.polymarket.gammaEndpoint,
      timeout: 30000,
    });

    this.dataClient = axios.create({
      baseURL: config.polymarket.dataEndpoint,
      timeout: 30000,
    });

    // Initialize wallet with ethers v5 (required by @polymarket/clob-client)
    this.wallet = new Wallet(config.wallet.privateKey);
    logger.info(`Initialized wallet: ${this.wallet.address}`);
  }

  /**
   * Initialize API credentials for authenticated requests.
   * If CLOB_API_KEY / CLOB_SECRET / CLOB_PASSPHRASE are set in .env, uses those.
   * Otherwise derives new credentials from the wallet's private key.
   */
  async initializeApiCredentials(): Promise<void> {
    try {
      const { apiKey, apiSecret, passphrase } = config.apiCredentials;

      if (apiKey && apiSecret && passphrase) {
        // Use pre-existing credentials from .env
        const creds: ApiKeyCreds = {
          key: apiKey,
          secret: apiSecret,
          passphrase: passphrase,
        };

        this.clobClient = new ClobClient(
          config.polymarket.clobEndpoint,
          config.wallet.chainId,
          this.wallet,
          creds,
          config.wallet.proxyAddress ? 2 : 0, // GNOSIS_SAFE=2 if proxy, EOA=0
          config.wallet.proxyAddress || this.wallet.address,
        );

        logger.info('CLOB client initialized with existing API credentials');
      } else {
        // Derive credentials from wallet
        const tempClient = new ClobClient(
          config.polymarket.clobEndpoint,
          config.wallet.chainId,
          this.wallet,
        );

        logger.info('Deriving API credentials from wallet...');
        const creds = await tempClient.createOrDeriveApiKey();

        this.clobClient = new ClobClient(
          config.polymarket.clobEndpoint,
          config.wallet.chainId,
          this.wallet,
          creds,
          config.wallet.proxyAddress ? 2 : 0,
          config.wallet.proxyAddress || this.wallet.address,
        );

        logger.info('CLOB client initialized with derived API credentials');
        logger.info('Save these credentials to your .env to avoid re-deriving:');
        logger.info(`  CLOB_API_KEY=${creds.key}`);
        logger.info(`  CLOB_SECRET=${creds.secret}`);
        logger.info(`  CLOB_PASSPHRASE=${creds.passphrase}`);
      }

    } catch (error) {
      logger.error('Failed to initialize API credentials', error);
      throw error;
    }
  }

  /**
   * Get orderbook for a token
   */
  async getOrderbook(tokenId: string, _depth: number = 50): Promise<Orderbook | null> {
    try {
      const book = await this.clobClient.getOrderBook(tokenId);
      return book as unknown as Orderbook;
    } catch (error: any) {
      logger.error(`Failed to fetch orderbook for token ${tokenId}`, {
        error: error.message,
        status: error.status,
      });
      return null;
    }
  }

  /**
   * Get market information from the Gamma API
   */
  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const response = await this.gammaClient.get('/markets', {
        params: { ids: marketId },
      });

      const markets = Array.isArray(response.data) ? response.data : [response.data];
      const market = markets.find((m: any) => m.id === marketId || m.id === parseInt(marketId));

      if (!market) {
        return null;
      }

      let tokenIds: string[] = [];
      if (market.clobTokenIds) {
        if (typeof market.clobTokenIds === 'string') {
          try {
            tokenIds = JSON.parse(market.clobTokenIds);
          } catch {
            tokenIds = [market.clobTokenIds];
          }
        } else if (Array.isArray(market.clobTokenIds)) {
          tokenIds = market.clobTokenIds;
        }
      }

      return {
        id: market.id?.toString() || marketId,
        question: market.question || market.title || '',
        slug: market.slug || '',
        conditionId: market.conditionId || '',
        clobTokenIds: tokenIds,
        active: market.active === true,
        closed: market.closed === true,
        outcomes: market.outcomes || [],
      };
    } catch (error: any) {
      logger.error(`Failed to fetch market ${marketId}`, {
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get user positions
   */
  async getPositions(userAddress?: string): Promise<Position[]> {
    try {
      const address = userAddress || this.wallet.address;
      const response = await this.dataClient.get('/positions', {
        params: { user: address },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      logger.error('Failed to fetch positions', {
        error: error.message,
        status: error.response?.status,
      });
      return [];
    }
  }

  /**
   * Get open orders via the CLOB client
   */
  async getOrders(): Promise<Order[]> {
    try {
      const orders = await this.clobClient.getOpenOrders();
      return (orders as any[]).map((o: any) => ({
        id: o.id || o.orderID || '',
        marketId: o.market || '',
        tokenId: o.asset_id || o.tokenID || '',
        side: o.side === 'BUY' ? 'BUY' : 'SELL',
        price: o.price?.toString() || '0',
        size: o.original_size?.toString() || o.size?.toString() || '0',
        filled: o.size_matched?.toString() || '0',
        status: o.status || 'OPEN',
        createdAt: o.created_at || new Date().toISOString(),
      }));
    } catch (error: any) {
      logger.error('Failed to fetch orders', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Place a limit order using the CLOB client (signed + authenticated)
   */
  async placeOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: string,
    size: string
  ): Promise<Order | null> {
    try {
      logger.info(`Placing ${side} order: ${size} @ ${price} for token ${tokenId}`);

      const resp = await this.clobClient.createAndPostOrder(
        {
          tokenID: tokenId,
          price: parseFloat(price),
          side: side === 'BUY' ? Side.BUY : Side.SELL,
          size: parseFloat(size),
        },
        { tickSize: '0.01', negRisk: false },
        OrderType.GTC,
      );

      if (resp && resp.orderID) {
        logger.info(`Order placed: ${resp.orderID}`);
        return {
          id: resp.orderID,
          marketId: '',
          tokenId,
          side,
          price,
          size,
          filled: '0',
          status: 'LIVE',
          createdAt: new Date().toISOString(),
        };
      }

      logger.warn('Order placement returned no orderID', resp);
      return null;
    } catch (error: any) {
      logger.error('Failed to place order', {
        error: error.message,
        tokenId,
        side,
        price,
        size,
      });
      return null;
    }
  }

  /**
   * Cancel an order via the CLOB client
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      logger.info(`Cancelling order ${orderId}`);
      await this.clobClient.cancelOrder({ orderID: orderId });
      logger.info(`Order cancelled: ${orderId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to cancel order ${orderId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Cancel all orders for a token
   */
  async cancelAllOrders(tokenId: string): Promise<boolean> {
    try {
      const orders = await this.getOrders();
      const tokenOrders = orders.filter((o) => o.tokenId === tokenId);

      const cancelPromises = tokenOrders.map((order) => this.cancelOrder(order.id));
      await Promise.all(cancelPromises);

      return true;
    } catch (error: any) {
      logger.error(`Failed to cancel all orders for token ${tokenId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return config.wallet.proxyAddress || this.wallet.address;
  }

  /**
   * Get the underlying CLOB client (for advanced usage)
   */
  getClobClient(): ClobClient {
    return this.clobClient;
  }
}
