import { escapeXml } from './svg.js';

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
  const entries = Array.isArray(languages)
    ? languages.slice(0, Math.max(1, maxLanguages)).filter((language) => language && language.name)
    : [];
  const background = /^#[0-9a-f]{6}$/i.test(String(colors?.background ?? ''))
    ? colors.background
    : '#0D1526';
  const barColor = /^#[0-9a-f]{6}$/i.test(String(colors?.cyan ?? '')) ? colors.cyan : '#22D3EE';
  const textColor = /^#[0-9a-f]{6}$/i.test(String(colors?.text ?? '')) ? colors.text : '#E2E8F0';
  const mutedColor = /^#[0-9a-f]{6}$/i.test(String(colors?.muted ?? '')) ? colors.muted : '#94A3B8';

  const rowHeight = 30;
  const barHeight = 18;
  const top = 24;
  const chartHeight = Math.max(120, top * 2 + entries.length * rowHeight);

  const bars = entries.map((language, index) => {
    const percentage = Math.min(100, Math.max(0, Number(language.displayPercentage) || 0));
    const barWidth = Math.max(0, (percentage / 100) * width);
    const y = top + index * rowHeight;
    const labelX = Math.max(40, Math.round(40 + barWidth + 8));
    const valueX = Math.max(40 + width - 90, 40);

    return [
      `  <rect x="40" y="${y}" width="${barWidth}" height="${barHeight}" fill="${barColor}"/>`,
      `  <text x="${labelX}" y="${y + barHeight}" font-family="sans-serif" font-size="12" fill="${textColor}">${escapeXml(language.name)}</text>`,
      `  <text x="${valueX}" y="${y + barHeight}" text-anchor="end" font-family="sans-serif" font-size="12" fill="${mutedColor}">${percentage.toFixed(2)}%</text>`,
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
    ...bars,
    legend,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n');

  return svg;
}
