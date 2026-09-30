import { renderCanonicalHtml } from '../projections/html-visibility.js';
import { renderCanonicalMarkdown } from '../projections/markdown-visibility.js';
import { projectCanonicalConversation } from '../projections/structured-visibility.js';

/**
 * Retains canonical events published by one registered provider agent.
 *
 * Provider plugins normalize provider-native observations.  Core owns this
 * retained canonical inventory and all projection/rendering operations over it.
 */
export class PluginCanonicalSession {
  #events = [];

  /**
   * Replaces the retained canonical event inventory.
   *
   * @param {Array<Object<string, *>>} events - Complete canonical event inventory.
   * @returns {void}
   */
  replace(events) {
    if (!Array.isArray(events)) {
      throw new TypeError('published canonical events must be an array');
    }
    this.#events = [...events];
  }

  /** @returns {Array<Object<string, *>>} Current complete canonical event inventory. */
  get events() {
    return this.#events;
  }

  /**
   * Projects the retained canonical inventory through Core's shared projection.
   *
   * @param {Object<string, *>} [options={}] - Projection options.
   * @returns {Object<string, *>} Structured canonical projection.
   */
  project(options = {}) {
    return projectCanonicalConversation(this.#events, options);
  }

  /**
   * Renders the retained canonical inventory through Core's Markdown renderer.
   *
   * @param {Object<string, *>} [options={}] - Rendering options.
   * @returns {string} Canonical Markdown.
   */
  renderMarkdown(options = {}) {
    return renderCanonicalMarkdown(this.#events, options);
  }

  /**
   * Renders the retained canonical inventory through Core's HTML renderer.
   *
   * @param {Object<string, *>} [options={}] - Rendering options.
   * @returns {string} Canonical HTML.
   */
  renderHtml(options = {}) {
    return renderCanonicalHtml(this.#events, options);
  }
}
