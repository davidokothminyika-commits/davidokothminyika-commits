import { assertNoPrivateRepositoryLeak } from '../processors/privacy.js';

/**
 * Validate generated Markdown before it may be staged or published.
 *
 * The check is fail-closed: empty output, missing trailing newline, unresolved
 * template placeholders and private-repository leakage are all invalid.
 */
export function validateMarkdown({ markdown, repositories } = {}) {
  const errors = [];

  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return { valid: false, errors: ['Generated README must be a non-empty Markdown string'] };
  }
  if (!markdown.endsWith('\n')) {
    errors.push('Generated README must end with a newline');
  }
  if (/\{\{.*?\}\}/s.test(markdown)) {
    errors.push('Generated README must not contain unresolved template placeholders');
  }
  try {
    assertNoPrivateRepositoryLeak(markdown, Array.isArray(repositories) ? repositories : []);
  } catch {
    errors.push('Generated README failed the private-repository leak gate');
  }

  return { valid: errors.length === 0, errors };
}
