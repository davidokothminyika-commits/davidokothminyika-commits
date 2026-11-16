import { describe, expect, it } from 'vitest';

import { generateTechStackSvg } from '../../src/generators/index.js';

const GROUPS = [
  { group: 'Backend', items: ['Node.js', 'Express', 'MySQL'] },
  { group: 'Frontend', items: ['React', 'JavaScript', 'HTML'] },
];
const COLORS = {
  background: '#0D1526',
  surfaceAlt: '#111C31',
  muted: '#94A3B8',
  cyan: '#22D3EE',
  border: '#1E293B',
};

describe('generateTechStackSvg', () => {
  it('renders every configured group and every configured technology', () => {
    const svg = generateTechStackSvg({ groups: GROUPS, width: 860, colors: COLORS });

    for (const group of GROUPS) {
      expect(svg).toContain(group.group);
      for (const item of group.items) {
        expect(svg).toContain(item);
      }
    }

    expect(svg).toContain('viewBox="0 0 860 ');
    expect(svg).toContain('role="img"');
    expect(svg.startsWith('<?xml')).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const first = generateTechStackSvg({ groups: GROUPS, width: 860, colors: COLORS });
    const second = generateTechStackSvg({ groups: GROUPS, width: 860, colors: COLORS });

    expect(first).toBe(second);
  });

  it('escapes configuration content so badges cannot inject markup', () => {
    const svg = generateTechStackSvg({
      groups: [{ group: '<script>alert(1)</script>', items: ['<b>x</b>'] }],
      width: 860,
      colors: COLORS,
    });

    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&lt;b&gt;');
  });

  it('rejects empty groups', () => {
    expect(() => generateTechStackSvg({ groups: [], colors: COLORS })).toThrow(TypeError);
    expect(() => generateTechStackSvg({ groups: null, colors: COLORS })).toThrow(TypeError);
    expect(() =>
      generateTechStackSvg({ groups: [{ group: '', items: [] }], colors: COLORS }),
    ).toThrow(TypeError);
  });

  it('rejects invalid width', () => {
    expect(() => generateTechStackSvg({ groups: GROUPS, width: 100, colors: COLORS })).toThrow(
      RangeError,
    );
  });
});
