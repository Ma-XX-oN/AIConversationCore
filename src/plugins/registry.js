import { deriveTurns } from '../derive/turns.js';

const PUBLIC_PI = Object.freeze([
  'sendMessage',
  'getResponse',
  'getTurns',
  'currentState',
  'observeState',
  'commTraffic',
  'version'
]);

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`agent plugin ${name} must be a function`);
  }
}

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

function creationContext(context) {
  if (!context || typeof context !== 'object') {
    throw new TypeError('agent plugin creation context must be an object');
  }
  return {
    ...context,
    core: Object.freeze({
      ...(context.core ?? {}),
      deriveTurns
    })
  };
}

export class AgentPluginRegistry {
  #apiVersion;
  #descriptors = new Map();

  constructor({ apiVersion = 1 } = {}) {
    if (!Number.isInteger(apiVersion) || apiVersion < 1) {
      throw new TypeError('apiVersion must be a positive integer');
    }
    this.#apiVersion = apiVersion;
  }

  get apiVersion() {
    return this.#apiVersion;
  }

  register(descriptor) {
    const validated = validateAgentPluginDescriptor(descriptor, this.#apiVersion);
    if (this.#descriptors.has(validated.id)) {
      throw new Error(`agent plugin ${validated.id} is already registered`);
    }
    this.#descriptors.set(validated.id, validated);
    return validated;
  }

  registerModule(module) {
    if (!module || typeof module !== 'object' || !module.default) {
      throw new TypeError('agent plugin module must expose a default descriptor');
    }
    return this.register(module.default);
  }

  get(id) {
    return this.#descriptors.get(id) ?? null;
  }

  create(id, context = {}) {
    const descriptor = this.#descriptors.get(id);
    if (!descriptor) throw new Error(`agent plugin ${id} is not registered`);
    return validateAgentInstance(
      descriptor.create(creationContext(context)),
      descriptor,
      this.#apiVersion
    );
  }

  recognize(input) {
    for (const descriptor of this.#descriptors.values()) {
      if (typeof descriptor.recognize !== 'function') continue;
      if (descriptor.recognize(input) === true) return descriptor;
    }
    return null;
  }

  list() {
    return [...this.#descriptors.values()];
  }
}

export { PUBLIC_PI };
