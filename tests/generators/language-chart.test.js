import { describe, expect, it } from 'vitest';

import { generateLanguageChartSvg } from '../../src/generators/index.js';

const THEME = {
  background: '#0D1526',
  cyan: '#22D3EE',
  text: '#E2E8F0',
  muted: '#94A3B8',
  border: '#1E293B',
};

describe('generateLanguageChartSvg', () => {
  it('renders one bar per public language within the limit', () => {
    const svg = generateLanguageChartSvg({
      width: 860,
      height: 260,
      maxLanguages: 8,
      showLegend: true,
      languages: [
        { name: 'JavaScript', displayPercentage: 80 },
        { name: 'Python', displayPercentage: 20 },
      ],
      colors: THEME,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="860"');
    expect(svg).toContain('JavaScript');
    expect(svg).toContain('Python');
    expect(svg).toContain('80.00%');
    expect(svg).toContain('20.00%');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<line');
    expect(svg).toContain('</svg>');
  });

  it('caps the chart at the configured language limit', () => {
    const languages = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => ({
      name: `Language-${index}`,
      displayPercentage: 10,
    }));

    const svg = generateLanguageChartSvg({
      width: 860,
      height: 260,
      maxLanguages: 3,
      languages,
      colors: THEME,
    });

    expect(svg.match(/<rect[^>]*fill="#22D3EE"/g)).toHaveLength(3);
  });

  it('skips entries without a name and renders an empty chart for no languages', () => {
    expect(() =>
      generateLanguageChartSvg({ languages: [{ displayPercentage: 50 }], colors: THEME }),
    ).not.toThrow();

    const svg = generateLanguageChartSvg({ languages: [], colors: THEME });

    expect(svg).toContain('<svg');
    expect(svg.match(/<rect[^>]*fill="#22D3EE"/g)?.length ?? 0).toBe(0);
  });

  it('renders without a legend when disabled', () => {
    const svg = generateLanguageChartSvg({
      languages: [{ name: 'Go', displayPercentage: 100 }],
      showLegend: false,
      colors: THEME,
    });

    expect(svg).not.toContain('<line');
  });
});
