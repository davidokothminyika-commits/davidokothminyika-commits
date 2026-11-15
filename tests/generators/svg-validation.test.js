import { describe, expect, it } from 'vitest';

import { validateSvg } from '../../src/generators/index.js';

describe('validateSvg', () => {
  it('accepts a well-formed generated banner', () => {
    const result = validateSvg({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="220"><rect width="1000" height="220" fill="#070B16"/></svg>',
      background: '#070B16',
      width: 1000,
      height: 220,
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty svg content', () => {
    expect(validateSvg({ svg: '   ', background: '#070B16' })).toEqual({
      valid: false,
      errors: ['Generated SVG must be a non-empty string'],
    });
  });

  it('rejects an svg that misses the configured background', () => {
    const result = validateSvg({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      background: '#070B16',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects an svg that misses the configured dimensions', () => {
    const result = validateSvg({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      background: '#070B16',
      width: 1000,
      height: 220,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
