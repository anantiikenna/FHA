const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter.
 * Returns { allowed: boolean, remaining: number, resetIn: number }.
 * windowMs = time window in milliseconds, max = max requests per window.
 */
export function rateLimit(
  key: string,
  windowMs: number = 60_000,
  max: number = 60
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetIn: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  const resetIn = entry.resetAt - now;

  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

/**
 * Rate limit keys by IP for a given request.
 */
export function rateLimitByIP(req: Request, windowMs?: number, max?: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return rateLimit(ip, windowMs, max);
}
