import Mustache from 'mustache';
import { deepFreeze } from '../utils/freeze.js';

/**
 * Render a Mustache template with the public template context.
 * Rendering is deterministic for identical input.
 */
export function renderTemplate({ source, context } = {}) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new TypeError('Template source must be a non-empty string');
  }
  if (!context || typeof context !== 'object') {
    throw new TypeError('Template context must be an object');
  }

  const frozenContext = deepFreeze(context);
  const markdown = Mustache.render(source, frozenContext);
  return markdown;
}
