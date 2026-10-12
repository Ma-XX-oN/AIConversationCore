import { AgentPluginRegistry } from './registry.js';

/** Core-owned catalogue of configured agent-plugin artifact identities. */
const AGENT_PLUGIN_CATALOG = Object.freeze({
  'chatgpt-web': Object.freeze({
    id: 'chatgpt-web',
    repository: 'Ma-XX-oN/Chat-Gpt-Plugin-2',
    ref: 'issue-125-subject-observer-v1',
    commit: '6b41cc22f8a1b06cf9d753fe5271119f51d35994',
    version: '0.1.0-issue.1.11',
    apiVersion: 1,
    path: 'dist/chatgpt-plugin.mjs',
    url: 'https://raw.githubusercontent.com/Ma-XX-oN/Chat-Gpt-Plugin-2/6b41cc22f8a1b06cf9d753fe5271119f51d35994/dist/chatgpt-plugin.mjs',
    gitBlobSha1: 'c44391e7329dd8783f8e640ca6afd3048154a221',
    byteLength: 54041
  })
});

/**
 * Returns the Core-owned artifact descriptor for one configured agent plugin.
 *
 * Downstream consumers use this only through generic host transport callbacks;
 * provider repository/ref/version/integrity identity remains owned by Core.
 *
 * @param {string} id - Agent plugin ID.
 * @returns {Object<string, *>} Frozen artifact descriptor.
 */
export function getAgentPluginArtifact(id) {
  const artifact = AGENT_PLUGIN_CATALOG[id];
  if (!artifact) throw new Error(`agent plugin ${id} is not configured`);
  return artifact;
}

/**
 * Loads, registers and creates one configured agent through Core.
 *
 * The host owns only artifact transport. It receives the Core-owned descriptor
 * and returns an imported module namespace; Core owns selection, registration,
 * API validation, agent construction, canonical session ownership and identity
 * verification.
 *
 * @param {string} id - Configured agent plugin ID.
 * @param {Object<string, *>} [options={}] - Loading options.
 * @param {function(Object<string, *>): Promise<Object<string, *>>} options.loadModule
 *   Generic host callback that transports/imports the selected artifact.
 * @param {Object<string, *>} [options.context={}] - Provider creation context.
 * @returns {Promise<Object<string, *>>} Agent, Core session, registry and artifact.
 */
export async function loadAgent(id, { loadModule, context = {} } = {}) {
  if (typeof loadModule !== 'function') {
    throw new TypeError('loadAgent requires a loadModule artifact transport function');
  }
  const artifact = getAgentPluginArtifact(id);
  const module = await loadModule(artifact);
  const registry = new AgentPluginRegistry({ apiVersion: artifact.apiVersion });
  registry.registerModule(module);
  const agent = registry.create(id, { ...context, ref: artifact.ref });
  const session = registry.session(agent);
  if (!session) throw new Error(`agent plugin ${id} did not receive a Core session`);

  const identity = agent.version();
  if (identity?.plugin !== artifact.id
      || identity?.version !== artifact.version
      || identity?.ref !== artifact.ref
      || identity?.apiVersion !== artifact.apiVersion) {
    throw new Error(`agent plugin ${id} artifact identity mismatch`);
  }

  return Object.freeze({ agent, session, registry, artifact });
}

export { AGENT_PLUGIN_CATALOG };
