import type { Clock } from './clock.ts';

/**
 * Fixed-window counter kept in memory (D8). One app instance makes this correct;
 * a restart resetting the counters is acceptable.
 */
export class FixedWindowLimiter {
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    readonly clock: Clock,
  ) {}

  #current(key: string) {
    const now = this.clock();
    let w = this.#windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      w = { start: now, count: 0 };
      this.#windows.set(key, w);
    }
    return w;
  }

  /** Whether the limit is already reached for `key` (does not count anything). */
  isLimited(key: string): boolean {
    return this.#current(key).count >= this.limit;
  }

  hit(key: string): void {
    this.#current(key).count++;
    if (this.#windows.size > 10_000) this.#sweep();
  }

  #sweep(): void {
    const now = this.clock();
    for (const [key, w] of this.#windows) if (now - w.start >= this.windowMs) this.#windows.delete(key);
  }
}
