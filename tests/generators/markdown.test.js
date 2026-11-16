import { describe, expect, it } from 'vitest';

import { renderReadme } from '../../src/generators/index.js';

describe('renderReadme', () => {
  it('renders the profile template into staged markdown', () => {
    const result = renderReadme({
      source: '# {{name}}\n\nMy name is {{name}} and today is {{date}}.',
      context: { name: 'David Okoth Minyika', date: 'Sunday 15 November' },
    });

    expect(result.markdown).toBe(
      '# David Okoth Minyika\n\nMy name is David Okoth Minyika and today is Sunday 15 November.',
    );
    expect(result.context.name).toBe('David Okoth Minyika');
  });
});
