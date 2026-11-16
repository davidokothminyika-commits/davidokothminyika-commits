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

function hexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value).toUpperCase() : fallback;
}

function textValue(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? fallback : text;
}

const WIDTH = 1000;
const HEIGHT = 220;

/**
 * Generate a deterministic SVG banner using the configured theme colours.
 *
 * The banner renders the configured identity on a subtle midnight gradient
 * with restrained cyan/violet/green accent geometry. Dynamic text is always
 * XML-escaped, the output is self-contained (no scripts, external fonts or
 * external resources) and stable for identical inputs.
 */
export function generateBannerSvg({
  width = WIDTH,
  height = HEIGHT,
  colors = {},
  title = null,
  subtitle = null,
} = {}) {
  const background = hexColor(colors?.background, '#070B16');
  const surface = hexColor(colors?.surface, '#0D1526');
  const cyan = hexColor(colors?.cyan, '#22D3EE');
  const violet = hexColor(colors?.violet, '#A78BFA');
  const green = hexColor(colors?.green, '#34D399');
  const textColor = hexColor(colors?.text, '#E2E8F0');
  const muted = hexColor(colors?.muted, '#94A3B8');
  const border = hexColor(colors?.border, '#1E293B');

  const name = textValue(title, '');
  const subtitleValue = textValue(subtitle, '');
  const hasSubtitle = subtitleValue !== '';
  const svgTitle = hasSubtitle
    ? `${name} — ${subtitleValue}`
    : name === ''
      ? 'Profile banner'
      : name;
  const ariaTarget = 'banner-title';

  // Name baseline and short cyan rule position scale with the canvas height.
  const center = Math.round(height / 2);
  const shortRuleY = Math.max(28, center - 46);
  const nameY = center + 12;
  const subtitleY = center + 40;

  const titleElement =
    name === ''
      ? []
      : [
          `    <text x="48" y="${nameY}" font-family="ui-sans-serif, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="48" letter-spacing="1.5" fill="${textColor}">${escapeXml(name)}</text>`,
        ];

  const subtitleElement = hasSubtitle
    ? [
        `    <text x="48" y="${subtitleY}" font-family="ui-sans-serif, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-weight="400" font-size="13" letter-spacing="0.6" fill="${muted}">${escapeXml(subtitleValue)}</text>`,
      ]
    : [];

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${ariaTarget}">`,
    `  <title id="${ariaTarget}">${escapeXml(svgTitle)}</title>`,
    '  <defs>',
    '    <linearGradient id="bannerBg" x1="0" y1="0" x2="1" y2="1">',
    `      <stop offset="0" stop-color="${background}"/>`,
    `      <stop offset="0.55" stop-color="${surface}"/>`,
    `      <stop offset="1" stop-color="${background}"/>`,
    '    </linearGradient>',
    '    <linearGradient id="topRail" x1="0" y1="0" x2="1" y2="0">',
    `      <stop offset="0" stop-color="${cyan}"/>`,
    `      <stop offset="0.5" stop-color="${violet}"/>`,
    `      <stop offset="1" stop-color="${green}"/>`,
    '    </linearGradient>',
    '    <linearGradient id="shortRail" x1="0" y1="0" x2="1" y2="0">',
    `      <stop offset="0" stop-color="${cyan}" stop-opacity="0.95"/>`,
    `      <stop offset="1" stop-color="${cyan}" stop-opacity="0"/>`,
    '    </linearGradient>',
    '    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="1">',
    `      <stop offset="0" stop-color="${cyan}"/>`,
    `      <stop offset="1" stop-color="${violet}"/>`,
    '    </linearGradient>',
    '    <radialGradient id="rightGlow" cx="0.85" cy="0.42" r="0.6">',
    `      <stop offset="0" stop-color="${cyan}" stop-opacity="0.12"/>`,
    `      <stop offset="0.45" stop-color="${violet}" stop-opacity="0.07"/>`,
    `      <stop offset="1" stop-color="${background}" stop-opacity="0"/>`,
    '    </radialGradient>',
    '  </defs>',
    `  <rect width="${width}" height="${height}" fill="url(#bannerBg)"/>`,
    `  <rect width="${width}" height="${height}" fill="url(#rightGlow)"/>`,
    `  <rect width="${width}" height="3" fill="url(#topRail)" fill-opacity="0.85"/>`,
    '  <g fill="none" stroke-linejoin="round" stroke-linecap="round">',
    `    <circle cx="878" cy="112" r="66" stroke="${cyan}" stroke-opacity="0.22" stroke-width="1.5"/>`,
    `    <circle cx="878" cy="112" r="38" stroke="${violet}" stroke-opacity="0.18" stroke-width="1.5"/>`,
    `    <circle cx="878" cy="112" r="12" fill="${violet}" fill-opacity="0.5"/>`,
    `    <path d="M716 190 L760 40 L988 124" stroke="url(#accentLine)" stroke-opacity="0.4" stroke-width="1.5"/>`,
    `    <circle cx="716" cy="190" r="3.5" fill="${cyan}" fill-opacity="0.7"/>`,
    `    <circle cx="760" cy="40" r="3.5" fill="${violet}" fill-opacity="0.7"/>`,
    `    <circle cx="988" cy="124" r="3.5" fill="${green}" fill-opacity="0.75"/>`,
    '  </g>',
    `  <rect x="46" y="${shortRuleY}" width="88" height="4" rx="2" fill="url(#shortRail)"/>`,
    ...titleElement,
    ...subtitleElement,
    `  <rect y="${height - 1}" width="${width}" height="1" fill="${border}" fill-opacity="0.9"/>`,
    '</svg>',
  ].join('\n');

  return svg;
}
