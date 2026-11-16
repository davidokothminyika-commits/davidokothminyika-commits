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

const PINNED_SLUG = {
  'Simple Icons': '17cd4ee07612198a1d8777a060d4100423762a8b',
  Devicon: '32fe1d3b3f36ad11f90ab94f7db59738139c2bf6',
};

// Per-icon licences as recorded in the pinned upstream data/simple-icons.json.
// Only these five Simple Icons entries carry an explicit `license` field.
const EXPLICIT_SIMPLE_ICONS_LICENSE = {
  JavaScript: 'MIT',
  Shell: 'MIT',
  Rust: 'CC-BY-SA-4.0',
  Ruby: 'CC-BY-SA-2.5',
  PHP: 'CC-BY-SA-4.0',
};

// Simple Icons entries with NO `license` field in the pinned upstream metadata.
const UNSPECIFIED_SIMPLE_ICONS = [
  'HTML',
  'TypeScript',
  'Kotlin',
  'C',
  'CSS',
  'Python',
  'Lua',
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
];

const DEVICON_ENTRIES = ['Java', 'C#', 'Vue', 'R'];

async function readDocs() {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  return readFileSync(join(process.cwd(), 'docs/ICONS.md'), 'utf8');
}

const UNLICENSED_OR_FALLBACK = ['Makefile', 'Mustache'];

describe('LANGUAGE_ICONS registry', () => {
  it('covers the current published language set with authentic logos', () => {
    for (const language of SUPPORTED) {
      expect(ICONS).toHaveProperty(language);
    }
  });

  it('pins every source URL to an upstream commit SHA', () => {
    for (const spec of Object.values(ICONS)) {
      expect(spec.source).toMatch(
        new RegExp(
          `raw\\.githubusercontent\\.com/[^/]+/[^/]+/(${PINNED_SLUG['Simple Icons']}|${PINNED_SLUG['Devicon']})/`,
        ),
      );
      expect(spec.source).not.toContain('/develop/');
      expect(spec.source).not.toContain('/master/');
    }
  });

  it('docs/ICONS.md records the pinned SHAs and per-icon licence table', async () => {
    const docs = await readDocs();

    for (const sha of Object.values(PINNED_SLUG)) {
      expect(docs).toContain(sha);
    }
    for (const language of Object.keys(ICONS)) {
      expect(docs).toContain(`| ${language}`);
    }
    expect(docs).toContain('CC-BY-SA-4.0');
    expect(docs).toContain('CC-BY-SA-2.5');
    expect(docs).toContain('MIT');
  });

  it('records the verified per-icon licence for the five explicit entries', () => {
    // Asserted against the registry so a licence edit is tied to its entry.
    for (const [key, licence] of Object.entries(EXPLICIT_SIMPLE_ICONS_LICENSE)) {
      expect(ICONS[key].license, key).toContain(licence);
    }
  });

  it('describes the remaining 18 Simple Icons entries as having no explicit licence field', () => {
    for (const key of UNSPECIFIED_SIMPLE_ICONS) {
      expect(ICONS[key].license, key).toContain('per-icon licence unspecified');
    }
    // Guard against silently merging an explicit entry into the unspecified set.
    for (const key of Object.keys(EXPLICIT_SIMPLE_ICONS_LICENSE)) {
      expect(UNSPECIFIED_SIMPLE_ICONS).not.toContain(key);
    }
    expect(UNSPECIFIED_SIMPLE_ICONS).toHaveLength(18);
  });

  it('keeps the four Devicon entries under the MIT collection licence', () => {
    for (const key of DEVICON_ENTRIES) {
      expect(ICONS[key].license, key).toMatch(/MIT/u);
    }
  });

  it('docs/ICONS.md gives per-entry attribution detail for explicit-licence icons', async () => {
    const docs = await readDocs();

    // Upstream origin pages from the pinned upstream metadata.
    expect(docs).toContain('https://php.net/download-logos.php');
    expect(docs).toContain('https://www.ruby-lang.org/en/about/logo/');
    expect(docs).toContain('https://www.rust-lang.org/policies/media-guide');
    expect(docs).toContain(
      'https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg',
    );
    expect(docs).toContain(
      'https://github.com/odb/official-bash-logo/tree/61eff022f2dad3c7468f5deb4f06652d15f2c143',
    );
    // Licence text links for the CC-BY-SA entries.
    expect(docs).toContain('https://creativecommons.org/licenses/by-sa/4.0/legalcode');
    expect(docs).toContain('https://creativecommons.org/licenses/by-sa/2.5/legalcode');
    // Modification status and the upstream metadata limitation are stated.
    expect(docs).toContain('Modifications: none');
    expect(docs).toContain('not supplied');
    // MIT notices reproduced or linked for the MIT entries.
    expect(docs).toContain('Copyright (c) 2015 konpa');
    expect(docs).toContain('© 2011 Christopher Williams');
    expect(docs).toContain('© 2016 ol');
  });

  it('docs/ICONS.md does not make unsupported attribution claims', async () => {
    const docs = await readDocs();

    expect(docs).not.toMatch(/sufficient attribution/i);
    expect(docs).not.toMatch(/satisf\w*\s+(?:any\s+)?(?:reasonable\s+)?attribution/i);
    expect(docs).not.toMatch(/full(?:y)?\s+compl(?:y|iance|iant)/i);
    // It must state precisely what upstream does NOT provide.
    expect(docs).toMatch(/creator[^.]*not\s+(?:supplied|recorded)/i);
    expect(docs).toMatch(/do\s+not\s+claim/i);
  });

  it('every entry records upstream source, licence, viewBox and verbatim paths', () => {
    for (const spec of Object.values(ICONS)) {
      expect(spec.source).toMatch(/^https:\/\/(raw\.githubusercontent\.com|github\.com)/u);
      expect(typeof spec.license).toBe('string');
      expect(spec.license.length).toBeGreaterThan(0);
      expect(spec.license).toMatch(/CC0|MIT|CC-BY-SA/u);
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
