/**
 * Validate generated SVG assets before they may be published.
 *
 * Generation is fail-closed: an asset that is empty, malformed or inconsistent
 * with the configured theme must never reach the published README or the 3D
 * asset set. Validation accepts the safe subset of SVG that the generators
 * emit: inline presentation attributes, internal gradients and `<title>`
 * elements. Scripts, external resources and non-SVG roots are rejected.
 */

const SANITIZED_PATTERNS = [
  /<\s*script\b/i,
  /<\s*foreignObject\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*audio\b/i,
  /<\s*video\b/i,
  /<\s*image\b/i,
  /<\s*use\b[^>]*(href|xlink:href)\s*=\s*["'](?!#)/i,
  /href\s*=\s*["']\s*(https?:|\/\/|data:)/i,
  /@import\b/i,
  /url\(\s*["']?\s*(https?:|\/\/|data:)/i,
  /<!\s*entity/i,
];

function collectSanitizationErrors(svg) {
  const errors = [];
  if (SANITIZED_PATTERNS.some((pattern) => pattern.test(svg))) {
    errors.push('Generated SVG must not contain scripts or external resource references');
  }
  return errors;
}

export function validateSvg({ svg, background, width, height } = {}) {
  const errors = [];

  if (typeof svg !== 'string' || svg.trim() === '') {
    return { valid: false, errors: ['Generated SVG must be a non-empty string'] };
  }
  if (!svg.includes('<svg')) {
    errors.push('Generated SVG must contain an <svg> root element');
  }
  if (typeof background === 'string' && !svg.includes(background)) {
    errors.push(`Generated SVG must use the configured background colour ${background}`);
  }
  if (Number.isInteger(width) && !svg.includes(`width="${width}"`)) {
    errors.push(`Generated SVG must use the configured width ${width}`);
  }
  if (Number.isInteger(height) && !svg.includes(`height="${height}"`)) {
    errors.push(`Generated SVG must use the configured height ${height}`);
  }

  errors.push(...collectSanitizationErrors(svg));

  return { valid: errors.length === 0, errors };
}
