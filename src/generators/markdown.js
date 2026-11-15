import { renderTemplate } from '../templates/index.js';

/**
 * Render the profile README from the Mustache template and public context.
 */
export function renderReadme({ context, source }) {
  const markdown = renderTemplate({ source, context });
  return { markdown, context };
}
