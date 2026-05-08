/**
 * In-memory sliding window rate limiter.
 * State lives in the Node.js process — resets on redeploy, which is acceptable
 * for abuse prevention (not a hard security boundary).
 */

const _windows = new Map<string, number[]>();

/**
 * Check and record a request against a rate limit window.
 * @param key       Unique key (e.g. "bet-explain:user-uuid")
 * @param max       Max allowed requests in the window
 * @param windowMs  Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const timestamps = _windows.get(key) ?? [];

  // Drop timestamps outside the current window
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= max) {
    const oldest = valid[0];
    _windows.set(key, valid);
    return { allowed: false, remaining: 0, resetInMs: windowMs - (now - oldest) };
  }

  valid.push(now);
  _windows.set(key, valid);
  return { allowed: true, remaining: max - valid.length, resetInMs: 0 };
}
