import { AgentPluginRegistry } from './registry.js';

/**
 * Reports registration diagnostics visibly through the host console.
 * @param {Object<string, *>} event - Immutable registration diagnostic.
 * @returns {void} Reports the diagnostic without modifying registry state.
 */
function reportRegistrationDiagnostic(event) {
  const method = event.level === 'error' ? 'error' : 'info';
  console[method](`[AIConversationCore] ${event.message}`, event);
}

/** Provider-neutral public registration subsystem and startup diagnostic. */
export class PluginRegistration {
  #registry = new AgentPluginRegistry({ requireMetadata: true });
  #missing = false;
  #timer;
  #cancel;
  #report;
  #listeners = new Set();
  #registeredListeners = new Set();

  /**
   * Starts the one-shot diagnostic when the subsystem is constructed.
   * @param {Object<string, *>} [options={}] - Host timers and diagnostic reporter.
   * @returns {PluginRegistration} Registration subsystem with an empty inventory.
   */
  constructor({
    schedule = globalThis.setTimeout?.bind(globalThis),
    cancel = globalThis.clearTimeout?.bind(globalThis),
    report = reportRegistrationDiagnostic
  } = {}) {
    if (typeof schedule !== 'function' || typeof cancel !== 'function'
        || typeof report !== 'function') {
      throw new TypeError('registration requires schedule, cancel and report functions');
    }
    this.#cancel = cancel;
    this.#report = report;
    this.#timer = schedule(() => {
      if (this.#registry.list().length !== 0) return;
      this.#missing = true;
      this.#emit('no-plugins', 'error', 'No agent plugins registered after 15 seconds.');
    }, 15000);
    // A Node import must not retain the process solely for a browser diagnostic.
    this.#timer?.unref?.();
  }

  /**
   * Emits an immutable diagnostic after the associated state transition.
   * @param {string} code - Machine-readable diagnostic identity.
   * @param {string} level - Console severity for the event.
   * @param {string} message - Human-readable error or recovery explanation.
   * @returns {void} Reports and delivers the diagnostic to current listeners.
   */
  #emit(code, level, message) {
    const event = Object.freeze({ code, level, message });
    try { this.#report(event); } catch (error) { console.error(error, event); }
    for (const listener of [...this.#listeners]) {
      try { listener(event); } catch (error) {
        const failure = Object.freeze({
          code: 'diagnostic-listener-error', level: 'error', message: String(error)
        });
        try { this.#report(failure); } catch (reportError) { console.error(reportError, failure); }
      }
    }
  }

  /**
   * Captures and atomically registers one provider's public descriptor.
   * @param {Object<string, *>} descriptor - Provider metadata and factory.
   * @returns {Object<string, *>} Immutable descriptor retained by Core.
   */
  register(descriptor) {
    let captured;
    try { captured = this.#registry.register(descriptor); } catch (error) {
      this.#emit('registration-error', 'error', String(error));
      throw error;
    }
    this.#cancel(this.#timer);
    if (this.#missing) {
      this.#missing = false;
      this.#emit('registration-recovered', 'info', 'Agent plugin registration recovered.');
    }
    for (const listener of [...this.#registeredListeners]) {
      try { listener(captured); } catch (error) {
        console.error('[AIConversationCore] registration observer error', error);
      }
    }
    return captured;
  }

  /**
   * Replays registered descriptors and observes future successful registrations.
   * No polling and no provider-specific knowledge; notification is after commit.
   * @param {function(Object<string, *>): void} listener - Provider listener.
   * @returns {function(): void} Independent idempotent unsubscribe function.
   */
  observeRegistrations(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('registration observer must be a function');
    }
    const wrapped = descriptor => { listener(descriptor); };
    this.#registeredListeners.add(wrapped);
    for (const descriptor of this.#registry.list()) {
      try { wrapped(descriptor); } catch (error) {
        console.error('[AIConversationCore] registration replay error', error);
      }
    }
    return () => { this.#registeredListeners.delete(wrapped); };
  }

  /**
   * Retrieves one registered provider without consulting any catalogue.
   * @param {string} id - Registered provider identifier.
   * @returns {Object<string, *>|null} Immutable descriptor or null.
   */
  get(id) { return this.#registry.get(id); }

  /**
   * Captures the current inventory in registration order.
   * @returns {Array<Object<string, *>>} Frozen snapshot of immutable descriptors.
   */
  list() { return Object.freeze(this.#registry.list()); }

  /**
   * Finds the first registered provider recognizing the source.
   * @param {*} input - Source identification supplied by the consumer.
   * @returns {Object<string, *>|null} Recognizing descriptor or null.
   */
  recognize(input) { return this.#registry.recognize(input); }

  /**
   * Constructs a validated agent and its Core-owned canonical session.
   * @param {string} id - Registered provider identifier.
   * @param {Object<string, *>} [context={}] - Host/provider creation services.
   * @returns {Object<string, *>} Frozen agent, session and descriptor association.
   */
  create(id, context = {}) {
    const agent = this.#registry.create(id, context);
    return Object.freeze({ agent, session: this.#registry.session(agent), descriptor: this.get(id) });
  }

  /** @returns {Object<string, *>|null} Retained incoming activity. */
  activityState(agent) { return this.#registry.activityState(agent); }

  /** @returns {function(): void} Independent activity observer unsubscribe. */
  observeActivity(agent, listener) { return this.#registry.observeActivity(agent, listener); }

  /** @returns {boolean} Whether retained activity was disposed. */
  disposeActivity(agent) { return this.#registry.disposeActivity(agent); }

  /**
   * Returns the registration inventory and current missing-plugin diagnostic state.
   * @returns {Object<string, *>} Immutable consistent registration snapshot.
   */
  state() {
    return Object.freeze({ apiVersion: 1, plugins: this.list(), missingPluginError: this.#missing });
  }

  /**
   * Subscribes to future registration diagnostic events.
   * @param {function(Object<string, *>): void} listener - Diagnostic receiver.
   * @returns {function(): void} Idempotent unsubscription function.
   */
  observeDiagnostics(listener) {
    if (typeof listener !== 'function') throw new TypeError('diagnostic listener must be a function');
    /**
     * Gives each subscription an independent lifetime, including repeated callbacks.
     * @param {Object<string, *>} event - Immutable diagnostic being delivered.
     * @returns {void} Delivers this event to the subscribed receiver.
     */
    const subscription = event => { listener(event); };
    this.#listeners.add(subscription);
    return () => { this.#listeners.delete(subscription); };
  }
}

/** Authoritative registration inventory for this loaded Core instance/realm. */
const pluginRegistration = new PluginRegistration();

/**
 * Registers an independently loaded provider on the authoritative Core inventory.
 * @param {Object<string, *>} descriptor - Provider metadata and factory.
 * @returns {Object<string, *>} Immutable registered descriptor.
 */
export function registerAgentPlugin(descriptor) { return pluginRegistration.register(descriptor); }

/**
 * Retrieves a provider from the authoritative inventory.
 * @param {string} id - Registered provider identifier.
 * @returns {Object<string, *>|null} Immutable descriptor or null.
 */
export function getAgentPlugin(id) { return pluginRegistration.get(id); }

/**
 * Returns the authoritative provider inventory in registration order.
 * @returns {Array<Object<string, *>>} Frozen descriptor snapshot.
 */
export function listAgentPlugins() { return pluginRegistration.list(); }

/**
 * Recognizes a source through registered providers only.
 * @param {*} input - Source identification supplied by the consumer.
 * @returns {Object<string, *>|null} Recognizing descriptor or null.
 */
export function recognizeAgentPlugin(input) { return pluginRegistration.recognize(input); }

/**
 * Creates an agent and canonical session from the authoritative registry.
 * @param {string} id - Registered provider identifier.
 * @param {Object<string, *>} [context={}] - Host/provider creation services.
 * @returns {Object<string, *>} Frozen agent, session and descriptor association.
 */
export function createAgent(id, context = {}) { return pluginRegistration.create(id, context); }

/**
 * Returns the authoritative registration diagnostic state.
 * @returns {Object<string, *>} Immutable inventory and diagnostic snapshot.
 */
export function getPluginRegistrationState() { return pluginRegistration.state(); }

/**
 * Subscribes to authoritative registration errors and recovery diagnostics.
 * @param {function(Object<string, *>): void} listener - Diagnostic receiver.
 * @returns {function(): void} Idempotent unsubscription function.
 */
export function observePluginRegistrationDiagnostics(listener) {
  return pluginRegistration.observeDiagnostics(listener);
}

/** @returns {Object<string, *>|null} Core-retained activity snapshot. */
export function activityState(agent) { return pluginRegistration.activityState(agent); }

/** @returns {function(): void} Independent activity observer unsubscribe. */
export function observeActivity(agent, listener) {
  return pluginRegistration.observeActivity(agent, listener);
}

/** @returns {boolean} Whether activity was disposed. */
export function disposeActivity(agent) { return pluginRegistration.disposeActivity(agent); }

/**
 * Observes successful generic provider registrations, replaying current inventory.
 * @param {function(Object<string, *>): void} listener - Provider listener.
 * @returns {function(): void} Independent unsubscribe.
 */
export function observeAgentPluginRegistration(listener) {
  return pluginRegistration.observeRegistrations(listener);
}
