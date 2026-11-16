import { describe, expect, it } from 'vitest';

import {
  generateLanguageChartSvg,
  getLanguageIconSpec,
  renderLanguageIcon,
  ICONS,
} from '../../src/generators/index.js';

const SUPPORTED = [
  'JavaScript',
  'HTML',
  'TypeScript',
  'Kotlin',
  'C',
  'CSS',
  'Shell',
  'Python',
  'Lua',
  'Rust',
  'Ruby',
  'PHP',
  'Swift',
  'Dart',
  'Scala',
  'Perl',
  'Haskell',
  'Clojure',
  'Elixir',
  'Svelte',
  'C++',
  'Go',
  'EJS',
  'Java',
  'C#',
  'Vue',
  'R',
];

const UNLICENSED_OR_FALLBACK = ['Makefile', 'Mustache'];

describe('LANGUAGE_ICONS registry', () => {
  it('covers the current published language set with authentic logos', () => {
    for (const language of SUPPORTED) {
      expect(ICONS).toHaveProperty(language);
    }
  });

  it('every entry records upstream source and licence', () => {
    for (const spec of Object.values(ICONS)) {
      expect(spec.source).toMatch(/^https:\/\/(raw\.githubusercontent\.com|github\.com)/u);
      expect(spec.license).toMatch(/CC0|MIT/u);
      expect(typeof spec.viewBox).toBe('string');
      expect(spec.paths.length).toBeGreaterThan(0);
      // No individual path uses an external url() reference.
      for (const path of spec.paths) {
        expect(typeof path === 'string' ? path : path.d).not.toMatch(/url\(https?:/u);
      }
    }
  });

  it('no entry uses trademark-exclusive non-commercial licences', () => {
    for (const spec of Object.values(ICONS)) {
      expect(spec.license).not.toMatch(/CC-BY-NC/u);
    }
  });
});

describe('getLanguageIconSpec', () => {
  it('returns exact entries for GitHub Linguist names (case-insensitive)', () => {
    for (const language of SUPPORTED) {
      const spec = getLanguageIconSpec(language);
      expect(spec, language).not.toBeNull();
      expect(spec?.language).toBe(language);
    }
    expect(getLanguageIconSpec('javascript')?.language).toBe('JavaScript');
    expect(getLanguageIconSpec('PYTHON')?.language).toBe('Python');
  });

  it('returns null for unsupported languages', () => {
    for (const language of UNLICENSED_OR_FALLBACK) {
      expect(getLanguageIconSpec(language)).toBeNull();
    }
    expect(getLanguageIconSpec('COBOL')).toBeNull();
  });

  it('returns null on invalid input', () => {
    expect(getLanguageIconSpec(null)).toBeNull();
    expect(getLanguageIconSpec(42)).toBeNull();
  });
});

describe('renderLanguageIcon', () => {
  it('renders a non-empty, self-contained SVG group for supported languages', () => {
    const svg = renderLanguageIcon({ name: 'JavaScript', x: 40, y: 24, size: 18 });

    expect(svg).toContain('<g');
    expect(svg).toContain('<path');
    expect(svg).toContain('JavaScript icon');
  });

  it('falls back to a slate tile when the language is unsupported', () => {
    const svg = renderLanguageIcon({ name: 'COBOL', x: 40, y: 24, size: 18 });

    expect(svg).toContain('<rect');
    expect(svg).toContain('#243447');
    expect(svg).not.toContain('<path');
  });

  it('escapes hostile names for the aria-label', () => {
    const svg = renderLanguageIcon({
      name: '<script>alert(1)</script>',
      x: 40,
      y: 24,
      size: 18,
    });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

const THEME = {
  background: '#070B16',
  cyan: '#22D3EE',
  text: '#E2E8F0',
  muted: '#94A3B8',
  border: '#1E293B',
};

describe('generateLanguageChartSvg with authentic icons', () => {
  it('embeds every supported language icon path', () => {
    const languages = [
      { name: 'JavaScript', displayPercentage: 39.52 },
      { name: 'HTML', displayPercentage: 36.37 },
      { name: 'TypeScript', displayPercentage: 9.76 },
      { name: 'Kotlin', displayPercentage: 8.91 },
      { name: 'C', displayPercentage: 2.89 },
      { name: 'CSS', displayPercentage: 0.86 },
      { name: 'Shell', displayPercentage: 0.67 },
      { name: 'EJS', displayPercentage: 0.5 },
    ];

    const svg = generateLanguageChartSvg({
      width: 860,
      languages,
      colors: THEME,
    });

    for (const language of languages) {
      expect(svg).toContain(`aria-label="${language.name} icon"`);
    }
  });

  it('renders a slate fallback badge, never a monogram, for unknown languages', () => {
    const svg = generateLanguageChartSvg({
      width: 860,
      languages: [{ name: 'COBOL', displayPercentage: 100 }],
      colors: THEME,
    });

    expect(svg).toContain('#243447');
    expect(svg).not.toContain('CO icon');
  });

  it('is deterministic', () => {
    const input = {
      width: 860,
      languages: [{ name: 'JavaScript', displayPercentage: 39.52 }],
      colors: THEME,
    };

    expect(generateLanguageChartSvg(input)).toBe(generateLanguageChartSvg(input));
  });

  it('keeps existing language statistics and ordering', () => {
    const languages = [
      { name: 'JavaScript', displayPercentage: 39.52 },
      { name: 'HTML', displayPercentage: 36.37 },
      { name: 'TypeScript', displayPercentage: 9.76 },
    ];

    const svg = generateLanguageChartSvg({
      width: 860,
      languages,
      colors: THEME,
    });

    const jsIndex = svg.indexOf('JavaScript icon');
    const htmlIndex = svg.indexOf('HTML icon');
    const tsIndex = svg.indexOf('TypeScript icon');
    expect(jsIndex).toBeLessThan(htmlIndex);
    expect(htmlIndex).toBeLessThan(tsIndex);
    expect(svg).toContain('39.52%');
    expect(svg).toContain('36.37%');
    expect(svg).toContain('9.76%');
  });
});
