/**
 * Validate generated SVG assets before they may be published.
 *
 * Generation is fail-closed: an asset that is empty, malformed or inconsistent
 * with the configured theme must never reach the published README or the 3D
 * asset set.
 */
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

  return { valid: errors.length === 0, errors };
}
