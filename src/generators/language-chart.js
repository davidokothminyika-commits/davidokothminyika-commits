import { escapeXml } from './svg.js';
import { renderLanguageIcon } from './language-icons.js';

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 16;
const TOP = 24;
const ICON_X = 40;
const LABEL_X = 66;
const VALUE_WIDTH = 72;
const LABEL_MIN_WIDTH = 64;
const LABEL_MAX_WIDTH = 200;

function labelWidthFor(languages) {
  const longest = languages.reduce(
    (max, language) => Math.max(max, String(language.name ?? '').length),
    0,
  );
  // 7 px per 12px sans-serif character plus 8 px separation.
  const estimated = longest * 7 + 8;
  return Math.min(LABEL_MAX_WIDTH, Math.max(LABEL_MIN_WIDTH, estimated));
}

/**
 * Generate a deterministic SVG language chart from public language summaries.
 *
 * Bars are sized from `displayPercentage` (the rounded, largest-remainder value
 * that sums to 100) and the chart never renders more than `maxLanguages` bars.
 * Only public aggregate language entries are accepted; callers must pass the
 * public summary built by `createPublicLanguageSummary`.
 */
export function generateLanguageChartSvg({
  width = 860,
  maxLanguages = 8,
  showLegend = true,
  languages = [],
  colors = {},
} = {}) {
  const entries = (Array.isArray(languages) ? languages : [])
    .slice(0, Math.max(1, maxLanguages))
    .filter((language) => language && language.name)
    .map((language) => ({
      ...language,
      name: String(language.name).slice(0, 24),
    }));
  const background = /^#[0-9a-f]{6}$/i.test(String(colors?.background ?? ''))
    ? colors.background
    : '#0D1526';
  const barColor = /^#[0-9a-f]{6}$/i.test(String(colors?.cyan ?? '')) ? colors.cyan : '#22D3EE';
  const textColor = /^#[0-9a-f]{6}$/i.test(String(colors?.text ?? '')) ? colors.text : '#E2E8F0';
  const mutedColor = /^#[0-9a-f]{6}$/i.test(String(colors?.muted ?? '')) ? colors.muted : '#94A3B8';

  const chartHeight = Math.max(120, TOP * 2 + entries.length * ROW_HEIGHT);
  const labelAreaWidth = labelWidthFor(entries);
  const barStart = LABEL_X + labelAreaWidth + 8;
  const barAreaMax = Math.max(40, width - VALUE_WIDTH - barStart - 8);

  const rows = entries.map((language, index) => {
    const percentage = Math.min(100, Math.max(0, Number(language.displayPercentage) || 0));
    const barWidth = Math.max(0, (percentage / 100) * barAreaMax);
    const y = TOP + index * ROW_HEIGHT;
    const valueX = width - 40;

    const iconHeight = 18;
    const iconY = Math.round(y + (BAR_HEIGHT - iconHeight) / 2);

    return [
      ...[
        renderLanguageIcon({
          name: language.name,
          x: ICON_X,
          y: iconY,
          size: iconHeight,
        }),
      ],
      `    <text x="${LABEL_X}" y="${y + BAR_HEIGHT}" font-family="ui-sans-serif, 'Segoe UI', Arial, sans-serif" font-weight="600" font-size="12" fill="${textColor}">${escapeXml(language.name)}</text>`,
      `    <rect x="${barStart}" y="${y}" width="${barWidth}" height="${BAR_HEIGHT}" fill="${barColor}"/>`,
      `    <text x="${valueX}" y="${y + BAR_HEIGHT}" text-anchor="end" font-family="ui-sans-serif, 'Segoe UI', Arial, sans-serif" font-size="12" fill="${mutedColor}">${percentage.toFixed(2)}%</text>`,
    ].join('\n');
  });

  const legend =
    showLegend && entries.length > 0
      ? `  <line x1="40" y1="${chartHeight - 8}" x2="${width - 40}" y2="${chartHeight - 8}" stroke="${colors?.border ?? '#1E293B'}"/>`
      : '';

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chartHeight}" viewBox="0 0 ${width} ${chartHeight}" role="img" aria-label="Language chart">`,
    `  <rect width="${width}" height="${chartHeight}" fill="${background}"/>`,
    ...rows,
    legend,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n');

  return svg;
}
