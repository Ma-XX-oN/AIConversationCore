import { deriveTurns } from '../derive/turns.js';
import { PluginCanonicalSession } from '../session/plugin-canonical-session.js';

/** Public provider-neutral methods every registered agent instance must expose. */
const PUBLIC_PI = Object.freeze([
  'sendMessage',
  'getResponse',
  'getTurns',
  'currentState',
  'observeState',
  'commTraffic',
  'version'
]);

/**
 * Requires a plugin contract member to be callable.
 *
 * @param {*} value - Candidate function value.
 * @param {string} name - Contract member name used in diagnostics.
 * @returns {void}
 */
function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`agent plugin ${name} must be a function`);
  }
}

/**
 * Validates one provider plugin descriptor against the Core plugin ABI.
 *
 * @param {Object<string, *>} descriptor - Provider plugin descriptor.
 * @param {number} [apiVersion=1] - Core plugin API version to require.
 * @returns {Object<string, *>} The validated descriptor.
 */
export function validateAgentPluginDescriptor(descriptor, apiVersion = 1) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('agent plugin descriptor must be an object');
  }
  if (typeof descriptor.id !== 'string' || !descriptor.id.trim()) {
    throw new TypeError('agent plugin descriptor id must be a non-empty string');
  }
  if (!Number.isInteger(descriptor.apiVersion)) {
    throw new TypeError('agent plugin descriptor apiVersion must be an integer');
  }
  if (descriptor.apiVersion !== apiVersion) {
    throw new Error(
      `agent plugin ${descriptor.id} API version ${descriptor.apiVersion} requires ${apiVersion}`
    );
  }
  requireFunction(descriptor.create, 'create');
  if (descriptor.recognize != null) requireFunction(descriptor.recognize, 'recognize');
  return descriptor;
}

/**
 * Verifies that one created provider agent satisfies the public Core PI.
 *
 * @param {Object<string, *>} instance - Created provider agent instance.
 * @param {Object<string, *>} descriptor - Descriptor that created the instance.
 * @param {number} apiVersion - Core plugin API version required by the registry.
 * @returns {Object<string, *>} The validated agent instance.
 */
function validateAgentInstance(instance, descriptor, apiVersion) {
  if (!instance || typeof instance !== 'object') {
    throw new TypeError(`agent plugin ${descriptor.id} create() must return an object`);
  }
  const missing = PUBLIC_PI.filter(name => typeof instance[name] !== 'function');
  if (missing.length) {
    throw new TypeError(
      `agent plugin ${descriptor.id} is missing public PI: ${missing.join(', ')}`
    );
  }
  const identity = instance.version();
  if (!identity || typeof identity !== 'object') {
    throw new TypeError(`agent plugin ${descriptor.id} version() must return an object`);
  }
  if (identity.plugin !== descriptor.id || identity.apiVersion !== apiVersion) {
    throw new Error(`agent plugin ${descriptor.id} identity mismatch`);
  }
  return instance;
}

/**
 * Builds the provider creation context with Core-owned canonical services.
 *
 * Caller-supplied `core` members may add services, but cannot replace Core's
 * canonical turn derivation or canonical-event publication services.
 *
 * @param {Object<string, *>} context - Caller/provider creation context.
 * @param {PluginCanonicalSession} session - Core-owned canonical session.
 * @returns {Object<string, *>} Creation context passed to the provider factory.
 */
function creationContext(context, session) {
  if (!context || typeof context !== 'object') {
    throw new TypeError('agent plugin creation context must be an object');
  }
  return {
    ...context,
    core: Object.freeze({
      ...(context.core ?? {}),
      deriveTurns,
      publishEvents: events => session.replace(events)
    })
  };
}

/** Registry for provider-neutral agent plugin descriptors and instances. */
export class AgentPluginRegistry {
  #apiVersion;
  #descriptors = new Map();
  #sessions = new WeakMap();

  /**
   * Creates a registry for one Core plugin API version.
   *
   * @param {Object<string, *>} [options={}] - Registry configuration.
   * @param {number} [options.apiVersion=1] - Supported plugin API version.
   */
  constructor({ apiVersion = 1 } = {}) {
    if (!Number.isInteger(apiVersion) || apiVersion < 1) {
      throw new TypeError('apiVersion must be a positive integer');
    }
    this.#apiVersion = apiVersion;
  }

  /** @returns {number} Core plugin API version accepted by this registry. */
  get apiVersion() {
    return this.#apiVersion;
  }

  /**
   * Registers one validated provider descriptor.
   *
   * @param {Object<string, *>} descriptor - Provider descriptor to register.
   * @returns {Object<string, *>} The registered descriptor.
   */
  register(descriptor) {
    const validated = validateAgentPluginDescriptor(descriptor, this.#apiVersion);
    if (this.#descriptors.has(validated.id)) {
      throw new Error(`agent plugin ${validated.id} is already registered`);
    }
    this.#descriptors.set(validated.id, validated);
    return validated;
  }

  /**
   * Registers the default descriptor exported by an imported plugin module.
   *
   * @param {Object<string, *>} module - Imported ESM module namespace.
   * @returns {Object<string, *>} The registered descriptor.
   */
  registerModule(module) {
    if (!module || typeof module !== 'object' || !module.default) {
      throw new TypeError('agent plugin module must expose a default descriptor');
    }
    return this.register(module.default);
  }

  /**
   * Looks up a registered provider descriptor by ID.
   *
   * @param {string} id - Provider plugin ID.
   * @returns {Object<string, *>|null} Registered descriptor or null.
   */
  get(id) {
    return this.#descriptors.get(id) ?? null;
  }

  /**
   * Creates and validates one provider agent instance.
   *
   * @param {string} id - Registered provider plugin ID.
   * @param {Object<string, *>} [context={}] - Provider creation context.
   * @returns {Object<string, *>} Validated provider agent instance.
   */
  create(id, context = {}) {
    const descriptor = this.#descriptors.get(id);
    if (!descriptor) throw new Error(`agent plugin ${id} is not registered`);
    const session = new PluginCanonicalSession();
    const instance = validateAgentInstance(
      descriptor.create(creationContext(context, session)),
      descriptor,
      this.#apiVersion
    );
    this.#sessions.set(instance, session);
    return instance;
  }

  /**
   * Returns the Core-owned canonical session associated with a created agent.
   *
   * @param {Object<string, *>} instance - Agent instance returned by `create()`.
   * @returns {PluginCanonicalSession|null} Associated canonical session or null.
   */
  session(instance) {
    return this.#sessions.get(instance) ?? null;
  }

  /**
   * Identifies the first registered provider that recognizes unknown input.
   *
   * @param {*} input - Unknown provider/source descriptor.
   * @returns {Object<string, *>|null} Recognizing descriptor or null.
   */
  recognize(input) {
    for (const descriptor of this.#descriptors.values()) {
      if (typeof descriptor.recognize !== 'function') continue;
      if (descriptor.recognize(input) === true) return descriptor;
    }
    return null;
  }

  /** @returns {Array<Object<string, *>>} Registered descriptors in insertion order. */
  list() {
    return [...this.#descriptors.values()];
  }
}

export { PUBLIC_PI };
