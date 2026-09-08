import { renderCanonicalMarkdown } from './markdown-visibility.js';
import { projectRevisionVisibility } from './revision-visibility.js';
import { projectCanonicalConversation as projectBaseConversation } from './structured.js';

/**
 * Resolves the effective visibility and revision status for one presentation node.
 *
 * @param {Object<string, *>} node - Canonical presentation node or turn.
 * @param {Map<string, Object<string, *>>} eventsById - Projected events by canonical ID.
 * @returns {Object<string, *>} Projection metadata for the presentation node.
 */
function nodeProjection(node, eventsById) {
  const sourceEvents = (node?.source ?? [])
    .map(source => eventsById.get(source?.event_id))
    .filter(Boolean);
  const visible = sourceEvents.length === 0 ||
    sourceEvents.some(event => event?.projection?.visible !== false);
  const revisionStatus = sourceEvents
    .map(event => event?.revision_status)
    .find(value => typeof value === 'string' && value.length) ?? null;
  return {
    visible,
    ...(revisionStatus ? { revision_status: revisionStatus } : {})
  };
}

/**
 * Adds visibility metadata to the canonical presentation tree without removing
 * nodes or changing their IDs/order.
 *
 * @param {Object<string, *>} presentation - Structured presentation wrapper.
 * @param {Array<Object<string, *>>} events - Projected canonical events.
 * @returns {Object<string, *>} Presentation wrapper with visibility metadata.
 */
function annotatePresentation(presentation, events) {
  const eventsById = new Map(events.map(event => [event?.id, event]));

  /**
   * Clones one presentation node recursively with projection metadata.
   *
   * @param {Object<string, *>} node - Presentation node.
   * @returns {Object<string, *>} Annotated node clone.
   */
  const annotateNode = node => ({
    ...node,
    projection: {
      ...(node?.projection ?? {}),
      ...nodeProjection(node, eventsById)
    },
    ...(Array.isArray(node?.children)
      ? { children: node.children.map(annotateNode) }
      : {})
  });

  const tree = presentation?.tree ?? {};
  return {
    ...presentation,
    tree: {
      ...tree,
      turns: (tree.turns ?? []).map(annotateNode)
    }
  };
}

/**
 * Projects a complete canonical event inventory for interactive consumers.
 *
 * Visibility changes annotate the same canonical events and presentation nodes;
 * they never remove or renumber them.  This preserves stable speech, search,
 * highlighting, and virtualization identities while allowing downstream UI to
 * hide/show historical revisions cheaply.
 *
 * @param {Array<Object<string, *>>} events - Complete canonical event inventory.
 * @param {Object<string, *>} options - Projection options.
 * @returns {Object<string, *>} Structured canonical projection.
 */
export function projectCanonicalConversation(events, options = {}) {
  const projectedEvents = projectRevisionVisibility(events, options);
  const result = projectBaseConversation(projectedEvents);
  return {
    ...result,
    events: projectedEvents,
    presentation: annotatePresentation(result.presentation, projectedEvents),
    projection_options: {
      include_rolled_back_turns: options?.includeRolledBackTurns === true
    },
    markdown: renderCanonicalMarkdown(events, options)
  };
}
