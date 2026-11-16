import { describe, expect, it } from 'vitest';

import { generateBannerSvg, validateSvg } from '../../src/generators/index.js';

const COLORS = {
  background: '#070B16',
  surface: '#0D1526',
  surfaceAlt: '#111C31',
  cyan: '#22D3EE',
  violet: '#A78BFA',
  green: '#34D399',
  text: '#E2E8F0',
  muted: '#94A3B8',
  border: '#1E293B',
};

describe('generateBannerSvg', () => {
  it('renders the required dimensions and viewBox', () => {
    const svg = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    expect(svg).toContain('width="1000"');
    expect(svg).toContain('height="220"');
    expect(svg).toContain('viewBox="0 0 1000 220"');
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg');
  });

  it('uses a subtle midnight gradient background', () => {
    const svg = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    expect(svg).toContain('id="bannerBg"');
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('#070B16');
    expect(svg).toContain('#0D1526');
  });

  it('uses cyan, violet and green accents without large bright fills', () => {
    const svg = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    expect(svg).toContain('#22D3EE');
    expect(svg).toContain('#A78BFA');
    expect(svg).toContain('#34D399');
    expect(svg).toContain('id="topRail"');
    expect(svg).toContain('id="shortRail"');
  });

  it('renders the configured name with strong display typography', () => {
    const svg = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    expect(svg).toContain('David Okoth Minyika');
    expect(svg).toMatch(/font-weight="800"/);
    expect(svg).toMatch(/font-size="\d{2}"\s+letter-spacing="1\.5"/);
    expect(svg).toContain('fill="#E2E8F0"');
  });

  it('uses the configured name and optional headline subtitle', () => {
    const withoutSubtitle = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });
    const withSubtitle = generateBannerSvg({
      colors: COLORS,
      title: 'David Okoth Minyika',
      subtitle: 'Full-stack developer · Node.js, Express, React & MySQL',
    });

    expect(withoutSubtitle).not.toContain('Full-stack developer');
    expect(withSubtitle).toContain('Full-stack developer');
    expect(withSubtitle).toMatch(/letter-spacing="0\.6"/);
    expect(withSubtitle).toContain('fill="#94A3B8"');
  });

  it('produces a deterministic output for identical input', () => {
    const first = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });
    const second = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    expect(first).toBe(second);
  });

  it('escapes dynamic text so it cannot inject markup', () => {
    const svg = generateBannerSvg({
      colors: COLORS,
      title: 'A <script>alert(1)</script> & friends',
      subtitle: 'x "quoted" & <tagged>',
    });

    expect(svg).not.toContain('<script>alert(1)</script>');
    expect(svg).not.toContain('"quoted"');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;quoted&quot;');
    expect(svg).toContain('&lt;tagged&gt;');
  });

  it('includes an accessible title and no scripts', () => {
    const svg = generateBannerSvg({
      colors: COLORS,
      title: 'David Okoth Minyika',
      subtitle: 'Full-stack developer',
    });

    expect(svg).toContain(
      '<title id="banner-title">David Okoth Minyika — Full-stack developer</title>',
    );
    expect(svg).not.toMatch(/<\s*script\b/i);
    expect(svg).not.toMatch(/<\s*foreignObject\b/i);
    expect(svg).not.toMatch(/href\s*=\s*["']\s*https?:/i);
    expect(svg).not.toMatch(/<\s*image\b/i);
  });

  it('keeps the background when validating', () => {
    const svg = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    const result = validateSvg({
      svg,
      background: '#070B16',
      width: 1000,
      height: 220,
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty and malformed output', () => {
    expect(validateSvg({ svg: '   ', background: '#070B16' })).toEqual({
      valid: false,
      errors: ['Generated SVG must be a non-empty string'],
    });
    expect(validateSvg({ svg: '<svg><rect/></svg>', background: '#070B16' })).toEqual({
      valid: false,
      errors: ['Generated SVG must use the configured background colour #070B16'],
    });
  });

  it('rejects scripts and external references', () => {
    const base = generateBannerSvg({ colors: COLORS, title: 'David Okoth Minyika' });

    const withScript = validateSvg({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="220"><rect fill="#070B16"/><script>alert(1)</script></svg>`,
      background: '#070B16',
      width: 1000,
      height: 220,
    });
    const withExternal = validateSvg({
      svg: base.replace('</svg>', '<image href="https://evil.example/x"/></svg>'),
      background: '#070B16',
      width: 1000,
      height: 220,
    });

    expect(withScript.valid).toBe(false);
    expect(withScript.errors.join(' ')).toContain('scripts or external resource references');
    expect(withExternal.valid).toBe(false);
    expect(withExternal.errors.join(' ')).toContain('scripts or external resource references');

    expect(validateSvg({ svg: base, background: '#070B16', width: 1000, height: 220 }).valid).toBe(
      true,
    );
  });
});
