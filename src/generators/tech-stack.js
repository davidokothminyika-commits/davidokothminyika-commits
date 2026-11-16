import { escapeXml } from './svg.js';

const ROW_HEIGHT = 44;
const TOP = 28;
const LEFT = 40;
const BADGE_HEIGHT = 22;
const MIN_BADGE_WIDTH = 40;

function badgeWidth(text) {
  // 11 px of padding plus a deterministic glyph-width estimate. Determinism
  // beats pixel-perfect fitting for badge layout.
  return Math.max(MIN_BADGE_WIDTH, Math.round(text.length * 6.6 + 22));
}

function requireHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? value : fallback;
}

/**
 * Generate a deterministic tech-stack badge SVG from the configured technology
 * groups. Groups are rendered as labelled rows of rounded badges; values are
 * escaped so configuration content can never inject SVG markup.
 */
export function generateTechStackSvg({ groups = [], width = 860, colors = {} } = {}) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new TypeError('groups must be a non-empty array of technology groups');
  }
  if (!Number.isInteger(width) || width < 400 || width > 1600) {
    throw new RangeError('width must be an integer between 400 and 1600');
  }

  const entries = groups
    .map((group) => ({
      group: String(group?.group ?? '').trim(),
      items: Array.isArray(group?.items)
        ? group.items.map((item) => String(item).trim()).filter((item) => item !== '')
        : [],
    }))
    .filter((group) => group.group !== '' && group.items.length > 0);

  if (entries.length === 0) {
    throw new TypeError('groups must include at least one group with items');
  }

  const background = requireHex(colors?.background, '#0D1526');
  const labelColor = requireHex(colors?.muted, '#94A3B8');
  const badgeFill = requireHex(colors?.surfaceAlt, '#111C31');
  const badgeText = requireHex(colors?.cyan, '#22D3EE');
  const border = requireHex(colors?.border, '#1E293B');

  const chartHeight = Math.max(140, TOP * 2 + entries.length * ROW_HEIGHT);
  const rows = entries.map((entry, index) => {
    const y = TOP + index * ROW_HEIGHT;
    let x = LEFT;
    const badges = entry.items.map((item) => {
      const widthForItem = badgeWidth(item);
      const badge = [
        `<rect x="${x}" y="${y}" width="${widthForItem}" height="${BADGE_HEIGHT}" rx="11" fill="${badgeFill}" stroke="${border}" stroke-width="1"/>`,
        `<text x="${x + widthForItem / 2}" y="${y + BADGE_HEIGHT - 7}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${badgeText}">${escapeXml(item)}</text>`,
      ].join('\n');
      x += widthForItem + 10;
      return `  ${badge}`;
    });

    return [
      `  <text x="${LEFT}" y="${y - 4}" font-family="sans-serif" font-size="13" font-weight="bold" fill="${labelColor}">${escapeXml(entry.group)}</text>`,
      ...badges,
    ].join('\n');
  });

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chartHeight}" viewBox="0 0 ${width} ${chartHeight}" role="img" aria-label="Tech stack">`,
    `  <rect width="${width}" height="${chartHeight}" fill="${background}"/>`,
    ...rows,
    '</svg>',
  ].join('\n');

  return svg;
}
