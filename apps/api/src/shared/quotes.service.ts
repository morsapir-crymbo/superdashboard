import { Injectable, Logger } from '@nestjs/common';

interface QuotesCache {
  data: Record<string, number>;
  fetchedAt: number;
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private cache: QuotesCache | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getQuotes(): Promise<Record<string, number>> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const quotes = await this.fetchQuotesFromApi();
      this.cache = { data: quotes, fetchedAt: Date.now() };
      return quotes;
    } catch (error) {
      this.logger.error('Failed to fetch quotes', error);
      if (this.cache) {
        return this.cache.data;
      }
      return this.getFallbackQuotes();
    }
  }

  private async fetchQuotesFromApi(): Promise<Record<string, number>> {
    const apiUrl = process.env.QUOTES_API_URL || 'https://api.coingecko.com/api/v3/simple/price';
    
    const cryptoIds = [
      'bitcoin', 'ethereum', 'tether', 'usd-coin', 'binancecoin',
      'ripple', 'cardano', 'solana', 'polkadot', 'dogecoin',
      'matic-network', 'litecoin', 'tron', 'avalanche-2', 'chainlink'
    ];

    try {
      const response = await fetch(
        `${apiUrl}?ids=${cryptoIds.join(',')}&vs_currencies=usd`
      );
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      const quotes: Record<string, number> = {
        USD: 1,
        EUR: 1.08,
        GBP: 1.27,
        CHF: 1.13,
        ILS: 0.27,
      };

      const symbolMap: Record<string, string> = {
        bitcoin: 'BTC',
        ethereum: 'ETH',
        tether: 'USDT',
        'usd-coin': 'USDC',
        binancecoin: 'BNB',
        ripple: 'XRP',
        cardano: 'ADA',
        solana: 'SOL',
        polkadot: 'DOT',
        dogecoin: 'DOGE',
        'matic-network': 'MATIC',
        litecoin: 'LTC',
        tron: 'TRX',
        'avalanche-2': 'AVAX',
        chainlink: 'LINK',
      };

      for (const [id, symbol] of Object.entries(symbolMap)) {
        if (data[id]?.usd) {
          quotes[symbol] = data[id].usd;
        }
      }

      return quotes;
    } catch (error) {
      this.logger.warn('Falling back to static quotes');
      return this.getFallbackQuotes();
    }
  }

  private getFallbackQuotes(): Record<string, number> {
    return {
      USD: 1,
      EUR: 1.08,
      GBP: 1.27,
      CHF: 1.13,
      ILS: 0.27,
      BTC: 65000,
      ETH: 3500,
      USDT: 1,
      USDC: 1,
      BNB: 580,
      XRP: 0.52,
      ADA: 0.45,
      SOL: 145,
      DOT: 7.2,
      DOGE: 0.08,
      MATIC: 0.58,
      LTC: 85,
      TRX: 0.12,
      AVAX: 35,
      LINK: 14,
    };
  }

  convertToUsd(amount: number, currency: string, quotes: Record<string, number>): number {
    if (currency === 'USD') return amount;
    const rate = quotes[currency] || 0;
    return amount * rate;
  }
}
