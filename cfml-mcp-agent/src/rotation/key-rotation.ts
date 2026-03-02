/**
 * API Key Rotation Manager
 * Round-robin rotation across multiple LLM provider keys with:
 * - Rate limit detection and automatic key retirement
 * - Cooldown periods with exponential backoff
 * - Health tracking per key
 * - Provider-specific rate limit headers parsing
 */

export interface ApiKey {
  id: string;
  provider: string;
  key: string;
  model?: string;
  priority?: number;        // Higher = preferred
  maxRPM?: number;          // Max requests per minute
  maxTPM?: number;          // Max tokens per minute
  costPerMToken?: number;   // Cost per million tokens (for budget tracking)
}

interface KeyHealth {
  key: ApiKey;
  requests: number;
  tokens: number;
  errors: number;
  rateLimitHits: number;
  lastUsed: number;
  cooldownUntil: number;
  isHealthy: boolean;
  windowStart: number;
  budgetUsed: number;       // USD
}

export interface RotationStats {
  totalRequests: number;
  totalTokens: number;
  totalErrors: number;
  keyStats: Record<string, Omit<KeyHealth, "key">>;
  activeKeys: number;
  coolingDownKeys: number;
}

// ─────────────────────────────────────────────
export class KeyRotationManager {
  private pool: Map<string, KeyHealth> = new Map();
  private currentIndex = 0;
  private budgetLimitUSD: number;

  constructor(keys: ApiKey[], budgetLimitUSD = 50) {
    this.budgetLimitUSD = budgetLimitUSD;
    for (const key of keys) {
      this.pool.set(key.id, {
        key,
        requests: 0,
        tokens: 0,
        errors: 0,
        rateLimitHits: 0,
        lastUsed: 0,
        cooldownUntil: 0,
        isHealthy: true,
        windowStart: Date.now(),
        budgetUsed: 0,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Get Next Available Key
  // ─────────────────────────────────────────────
  getNextKey(provider?: string): ApiKey | null {
    const now = Date.now();
    const candidates = Array.from(this.pool.values())
      .filter((h) => {
        if (!h.isHealthy) return false;
        if (h.cooldownUntil > now) return false;
        if (provider && h.key.provider !== provider) return false;
        // Reset window if > 60s
        if (now - h.windowStart > 60_000) {
          h.requests = 0;
          h.tokens = 0;
          h.windowStart = now;
        }
        if (h.key.maxRPM && h.requests >= h.key.maxRPM) return false;
        if (h.budgetUsed >= this.budgetLimitUSD) return false;
        return true;
      })
      .sort((a, b) => (b.key.priority || 1) - (a.key.priority || 1));

    if (!candidates.length) return null;

    // Priority-weighted round-robin
    const selected = candidates[this.currentIndex % candidates.length];
    this.currentIndex++;

    return selected.key;
  }

  // ─────────────────────────────────────────────
  // Record Success
  // ─────────────────────────────────────────────
  recordSuccess(keyId: string, tokensUsed: number) {
    const health = this.pool.get(keyId);
    if (!health) return;

    health.requests++;
    health.tokens += tokensUsed;
    health.lastUsed = Date.now();
    health.errors = Math.max(0, health.errors - 1); // Recover from previous errors

    // Track cost
    const costPerMToken = health.key.costPerMToken || 0;
    health.budgetUsed += (tokensUsed / 1_000_000) * costPerMToken;
  }

  // ─────────────────────────────────────────────
  // Record Rate Limit
  // ─────────────────────────────────────────────
  recordRateLimit(keyId: string, retryAfterMs?: number) {
    const health = this.pool.get(keyId);
    if (!health) return;

    health.rateLimitHits++;
    const backoff = retryAfterMs || this.exponentialBackoff(health.rateLimitHits);
    health.cooldownUntil = Date.now() + backoff;

    console.error(`[KeyRotation] Key ${keyId} rate limited. Cooling down ${backoff}ms`);
  }

  // ─────────────────────────────────────────────
  // Record Error
  // ─────────────────────────────────────────────
  recordError(keyId: string, fatal = false) {
    const health = this.pool.get(keyId);
    if (!health) return;

    health.errors++;

    if (fatal || health.errors >= 5) {
      health.isHealthy = false;
      console.error(`[KeyRotation] Key ${keyId} marked unhealthy after ${health.errors} errors`);
    } else {
      // Soft cooldown
      health.cooldownUntil = Date.now() + 5_000 * health.errors;
    }
  }

  // ─────────────────────────────────────────────
  // Parse Rate Limit Headers (OpenAI/Anthropic/etc.)
  // ─────────────────────────────────────────────
  parseRateLimitHeaders(keyId: string, headers: Record<string, string>) {
    const retryAfter = headers["retry-after"] || headers["x-ratelimit-reset-requests"];
    if (retryAfter) {
      const ms = isNaN(Number(retryAfter))
        ? new Date(retryAfter).getTime() - Date.now()
        : Number(retryAfter) * 1000;
      this.recordRateLimit(keyId, Math.max(ms, 1000));
    }
  }

  // ─────────────────────────────────────────────
  // Recover Unhealthy Keys (for health check intervals)
  // ─────────────────────────────────────────────
  recoverKey(keyId: string) {
    const health = this.pool.get(keyId);
    if (health) {
      health.isHealthy = true;
      health.errors = 0;
      health.cooldownUntil = 0;
      health.rateLimitHits = 0;
      console.log(`[KeyRotation] Key ${keyId} recovered`);
    }
  }

  // ─────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────
  getStats(): RotationStats {
    const now = Date.now();
    let totalRequests = 0, totalTokens = 0, totalErrors = 0;
    let activeKeys = 0, coolingDownKeys = 0;
    const keyStats: Record<string, any> = {};

    for (const [id, h] of this.pool) {
      totalRequests += h.requests;
      totalTokens += h.tokens;
      totalErrors += h.errors;
      if (h.isHealthy && h.cooldownUntil <= now) activeKeys++;
      if (h.cooldownUntil > now) coolingDownKeys++;

      const { key, ...stats } = h;
      keyStats[id] = {
        ...stats,
        provider: key.provider,
        model: key.model,
        cooldownRemaining: Math.max(0, h.cooldownUntil - now),
      };
    }

    return { totalRequests, totalTokens, totalErrors, keyStats, activeKeys, coolingDownKeys };
  }

  // ─────────────────────────────────────────────
  private exponentialBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 60_000);
  }
}
