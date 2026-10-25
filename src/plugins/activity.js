/**
 * Provider-neutral, Core-owned retained incoming activity contract revision.
 * Provider plugins select the event timestamp at receipt; Core never invents it.
 */
export const RETAINED_ACTIVITY_API_VERSION = 1;

/**
 * Retains the newest incoming timestamp for one agent, independently of
 * canonical events and provider lifecycle state.
 */
export class RetainedActivityObserver {
  /** @type {function(): number} Clock for validation, never for stamping. */
  #now;
  /** @type {Object<string, *>} Immutable latest activity snapshot. */
  #state = Object.freeze({
    apiVersion: RETAINED_ACTIVITY_API_VERSION,
    clockDomain: 'unix-epoch-ms',
    latestIncomingAtMs: null
  });
  /** @type {Set<{callback: function(Object<string, *>): void}>} Active subscriptions. */
  #listeners = new Set();
  /** @type {boolean} Whether this per-agent observer was retired. */
  #disposed = false;
  /** @type {boolean} Prevent recursive notification from reversing delivery. */
  #dispatching = false;
  /** @type {boolean} An update occurred during a notification pass. */
  #pending = false;

  /**
   * Creates a retained activity observer for a single agent lifetime.
   *
   * @param {{now?: function(): number}} [options={}] - Wall clock used only
   *   for rejecting invalid or future provider-supplied timestamps.
   */
  constructor({ now = Date.now } = {}) {
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    this.#now = now;
  }

  /**
   * Returns the immutable most recent retained activity snapshot.
   *
   * @returns {{apiVersion: number, clockDomain: string, latestIncomingAtMs: number|null}}
   *   The last accepted epoch-millisecond timestamp, or null if unavailable.
   */
  snapshot() {
    return this.#state;
  }

  /**
   * Retains a timestamp chosen by the producer at actual incoming receipt.
   * This method never substitutes the callback/publication time.
   *
   * @param {*} timestampMs - Provider-selected Unix epoch milliseconds.
   * @returns {boolean} Whether this call advanced the retained timestamp.
   */
  publish(timestampMs) {
    if (this.#disposed) return false;
    if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) return false;
    // This is a validation bound only, not a receipt-time fallback.
    const validationTime = this.#now();
    if (!Number.isFinite(validationTime) || timestampMs > validationTime) return false;
    const prior = this.#state.latestIncomingAtMs;
    if (prior !== null && timestampMs <= prior) return false;
    this.#state = Object.freeze({
      apiVersion: RETAINED_ACTIVITY_API_VERSION,
      clockDomain: 'unix-epoch-ms',
      latestIncomingAtMs: timestampMs
    });
    this.#pending = true;
    if (this.#dispatching) return true;

    this.#dispatching = true;
    try {
      while (this.#pending && !this.#disposed) {
        this.#pending = false;
        const current = this.#state;
        for (const subscription of [...this.#listeners]) {
          if (this.#disposed) break;
          if (!this.#listeners.has(subscription)) continue;
          try {
            subscription.callback(current);
          } catch {
            // One consumer cannot break delivery or provider receipt handling.
          }
        }
      }
    } finally {
      this.#dispatching = false;
    }
    return true;
  }

  /**
   * Registers a consumer, replaying the current snapshot synchronously once.
   *
   * @param {function(Object<string, *>): void} callback - Activity consumer.
   * @returns {function(): void} Idempotent subscription cancellation.
   */
  subscribe(callback) {
    if (this.#disposed) throw new Error('activity observer disposed');
    if (typeof callback !== 'function') {
      throw new TypeError('activity listener must be a function');
    }
    // Identity belongs to the subscription, not to a possibly reused callback.
    const subscription = { callback };
    this.#listeners.add(subscription);
    const snapshot = this.#state;
    try {
      callback(snapshot);
    } catch {
      // Initial replay has the same listener isolation as live publication.
    }
    return () => {
      this.#listeners.delete(subscription);
    };
  }

  /**
   * Retires the old agent on teardown or replacement without notifying again.
   *
   * @returns {void} The listener and publication channel are closed.
   */
  dispose() {
    this.#disposed = true;
    this.#listeners.clear();
    this.#pending = false;
  }
}
