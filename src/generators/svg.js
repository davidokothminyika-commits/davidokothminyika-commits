/**
 * Shared XML helpers and banner SVG generation for published profile assets.
 */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a deterministic SVG banner using the configured theme colours.
 *
 * Phase 6 generates the asset shell. The banner carries the theme background
 * and, when a title is supplied, a single safe text element. Values are escaped
 * so caller-provided text can never inject SVG markup.
 */
export function generateBannerSvg({ width = 1000, height = 220, colors = {}, title = null } = {}) {
  const background = /^#[0-9a-f]{6}$/i.test(String(colors?.background ?? ''))
    ? colors.background
    : '#070B16';
  const textColor = /^#[0-9a-f]{6}$/i.test(String(colors?.text ?? '')) ? colors.text : '#E2E8F0';
  const titleValue = typeof title === 'string' && title.trim() !== '' ? title.trim() : null;

  const texts = titleValue
    ? [
        `<text x="40" y="${Math.max(40, Math.round(height / 2))}" font-family="sans-serif" font-size="28" fill="${textColor}">${escapeXml(titleValue)}</text>`,
      ]
    : [];

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Profile banner">`,
    `  <rect width="${width}" height="${height}" fill="${background}"/>`,
    ...texts,
    '</svg>',
  ].join('\n');

  return svg;
}
