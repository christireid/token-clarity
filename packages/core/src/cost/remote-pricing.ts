/**
 * @module cost/remote-pricing
 * Remote pricing fetcher with caching and fallback
 */

import { MODEL_PRICING, updatePricing } from './pricing.js';
import type { ModelPricing } from './types.js';

/**
 * Pricing source configuration
 */
export interface PricingSource {
  /** Source URL */
  url: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Cached pricing data
 */
interface CachedPricing {
  data: Record<string, ModelPricing>;
  timestamp: number;
  ttl: number;
}

/**
 * Remote pricing fetcher options
 */
export interface RemotePricingOptions {
  /** Custom pricing sources (in priority order) */
  sources?: PricingSource[];
  /** Default cache TTL in ms (default: 24 hours) */
  defaultCacheTTL?: number;
  /** Storage adapter for caching */
  storage?: PricingStorage;
  /** Auto-update interval in ms (0 = disabled) */
  autoUpdateInterval?: number;
  /** Callback when pricing is updated */
  onUpdate?: (pricing: Record<string, ModelPricing>) => void;
  /** Callback on fetch error */
  onError?: (error: Error, source: string) => void;
}

/**
 * Storage adapter for pricing cache
 */
export interface PricingStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Default localStorage adapter (browser)
 */
const localStorageAdapter: PricingStorage = {
  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  },
};

/**
 * Memory storage adapter (Node.js / SSR)
 */
const memoryStorage: Map<string, string> = new Map();
const memoryStorageAdapter: PricingStorage = {
  async get(key: string): Promise<string | null> {
    return memoryStorage.get(key) ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    memoryStorage.set(key, value);
  },
  async remove(key: string): Promise<void> {
    memoryStorage.delete(key);
  },
};

const CACHE_KEY = 'token-optimizer-pricing-cache';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Default pricing sources
 */
const defaultSources: PricingSource[] = [
  // Primary: GitHub raw (our own pricing file)
  {
    url: 'https://raw.githubusercontent.com/token-optimizer/pricing/main/models.json',
    priority: 1,
    cacheTTL: 6 * 60 * 60 * 1000, // 6 hours
  },
  // Fallback: jsDelivr CDN
  {
    url: 'https://cdn.jsdelivr.net/gh/token-optimizer/pricing@main/models.json',
    priority: 2,
    cacheTTL: 12 * 60 * 60 * 1000, // 12 hours
  },
];

/**
 * Remote pricing fetcher class
 */
export class RemotePricingFetcher {
  private sources: PricingSource[];
  private storage: PricingStorage;
  private defaultCacheTTL: number;
  private autoUpdateInterval: number;
  private onUpdate?: (pricing: Record<string, ModelPricing>) => void;
  private onError?: (error: Error, source: string) => void;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: number = 0;

  constructor(options: RemotePricingOptions = {}) {
    this.sources = options.sources ?? defaultSources;
    this.defaultCacheTTL = options.defaultCacheTTL ?? DEFAULT_TTL;
    this.autoUpdateInterval = options.autoUpdateInterval ?? 0;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;

    // Select appropriate storage
    this.storage = options.storage ??
      (typeof localStorage !== 'undefined' ? localStorageAdapter : memoryStorageAdapter);

    // Start auto-update if enabled
    if (this.autoUpdateInterval > 0) {
      this.startAutoUpdate();
    }
  }

  /**
   * Fetch latest pricing from remote sources
   */
  async fetch(): Promise<Record<string, ModelPricing> | null> {
    // Sort sources by priority
    const sortedSources = [...this.sources].sort((a, b) => a.priority - b.priority);

    for (const source of sortedSources) {
      try {
        const response = await fetch(source.url, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as Record<string, ModelPricing>;

        // Validate data structure
        if (!this.validatePricingData(data)) {
          throw new Error('Invalid pricing data structure');
        }

        // Cache the result
        await this.cache(data, source.cacheTTL ?? this.defaultCacheTTL);

        // Update global pricing
        this.applyPricing(data);

        this.lastFetch = Date.now();
        return data;
      } catch (error) {
        this.onError?.(error as Error, source.url);
        continue; // Try next source
      }
    }

    return null; // All sources failed
  }

  /**
   * Get cached pricing or fetch if expired
   */
  async getOrFetch(): Promise<Record<string, ModelPricing>> {
    const cached = await this.getCached();

    if (cached && !this.isCacheExpired(cached)) {
      return cached.data;
    }

    // Try to fetch fresh data
    const fresh = await this.fetch();
    if (fresh) {
      return fresh;
    }

    // Return cached data even if expired, or fall back to built-in
    return cached?.data ?? this.getBuiltInPricing();
  }

  /**
   * Get cached pricing data
   */
  async getCached(): Promise<CachedPricing | null> {
    try {
      const stored = await this.storage.get(CACHE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as CachedPricing;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Cache pricing data
   */
  private async cache(data: Record<string, ModelPricing>, ttl: number): Promise<void> {
    const cached: CachedPricing = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    await this.storage.set(CACHE_KEY, JSON.stringify(cached));
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(cached: CachedPricing): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * Validate pricing data structure
   */
  private validatePricingData(data: unknown): data is Record<string, ModelPricing> {
    if (!data || typeof data !== 'object') return false;

    for (const [_key, value] of Object.entries(data)) {
      if (!value || typeof value !== 'object') return false;
      const pricing = value as Record<string, unknown>;

      // Check required fields
      if (
        typeof pricing.inputPer1k !== 'number' ||
        typeof pricing.outputPer1k !== 'number' ||
        typeof pricing.contextWindow !== 'number'
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply pricing data to global pricing
   */
  private applyPricing(data: Record<string, ModelPricing>): void {
    for (const [model, pricing] of Object.entries(data)) {
      updatePricing(model, pricing);
    }
    this.onUpdate?.(data);
  }

  /**
   * Get built-in pricing as fallback
   */
  private getBuiltInPricing(): Record<string, ModelPricing> {
    return { ...MODEL_PRICING };
  }

  /**
   * Start auto-update timer
   */
  startAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      this.fetch().catch(() => {
        // Errors are handled by onError callback
      });
    }, this.autoUpdateInterval);
  }

  /**
   * Stop auto-update timer
   */
  stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Clear cached pricing
   */
  async clearCache(): Promise<void> {
    await this.storage.remove(CACHE_KEY);
  }

  /**
   * Get time since last fetch
   */
  getLastFetchTime(): number {
    return this.lastFetch;
  }

  /**
   * Force refresh pricing
   */
  async refresh(): Promise<Record<string, ModelPricing> | null> {
    await this.clearCache();
    return this.fetch();
  }
}

/**
 * Singleton instance
 */
let globalFetcher: RemotePricingFetcher | null = null;

/**
 * Get or create global pricing fetcher
 */
export function getRemotePricingFetcher(options?: RemotePricingOptions): RemotePricingFetcher {
  if (!globalFetcher) {
    globalFetcher = new RemotePricingFetcher(options);
  }
  return globalFetcher;
}

/**
 * Initialize remote pricing (call early in app lifecycle)
 */
export async function initializeRemotePricing(
  options?: RemotePricingOptions
): Promise<Record<string, ModelPricing>> {
  const fetcher = getRemotePricingFetcher(options);
  return fetcher.getOrFetch();
}

/**
 * Refresh pricing from remote sources
 */
export async function refreshPricing(): Promise<Record<string, ModelPricing> | null> {
  const fetcher = getRemotePricingFetcher();
  return fetcher.refresh();
}
