import { describe, expect, it } from 'vitest';

import { generateBannerSvg } from '../../src/generators/index.js';

describe('generateBannerSvg', () => {
  it('generates a banner with the configured theme background and optional title', () => {
    const svg = generateBannerSvg({
      width: 1000,
      height: 220,
      colors: { background: '#070B16', text: '#E2E8F0' },
      title: 'David Okoth',
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="1000"');
    expect(svg).toContain('height="220"');
    expect(svg).toContain('fill="#070B16"');
    expect(svg).toContain('David Okoth');
    expect(svg).toContain('fill="#E2E8F0"');
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('renders a single escaped title when supplied', () => {
    const svg = generateBannerSvg({
      width: 1000,
      height: 220,
      colors: { background: '#070B16', text: '#E2E8F0' },
      title: 'A <script>alert(1)</script> & friends',
    });

    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('A &lt;script&gt;');
    expect(svg).not.toContain('<script>');
  });

  it('uses safe defaults when no theme colours are supplied', () => {
    const svg = generateBannerSvg();

    expect(svg).toContain('fill="#070B16"');
    expect(svg).not.toContain('fill="#undefined"');
  });

  it('renders a background-only banner when no title is supplied', () => {
    const svg = generateBannerSvg({ colors: { background: '#070B16' } });

    expect(svg).not.toContain('<text');
    expect(svg).toContain('</svg>');
  });
});
