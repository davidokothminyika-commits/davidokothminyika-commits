import { describe, expect, it } from 'vitest';

import { renderTemplate } from '../../src/templates/index.js';

describe('renderTemplate', () => {
  it('renders simple placeholders from the context', () => {
    const markdown = renderTemplate({
      source: 'My name is {{name}} and today is {{date}}.',
      context: { name: 'David Okoth Minyka', date: 'Sunday 15 November' },
    });

    expect(markdown).toBe('My name is David Okoth Minyka and today is Sunday 15 November.');
  });

  it('renders array sections', () => {
    const markdown = renderTemplate({
      source: '{{#items}}- {{.}}\n{{/items}}',
      context: { items: ['one', 'two'] },
    });

    expect(markdown).toBe('- one\n- two\n');
  });

  it('renders nested object properties', () => {
    const markdown = renderTemplate({
      source: 'Stars: {{statistics.stars}}',
      context: { statistics: { stars: 7 } },
    });

    expect(markdown).toBe('Stars: 7');
  });

  it('is deterministic for identical input', () => {
    const source = '# {{name}}\n\n{{#about}}- {{.}}\n{{/about}}';
    const context = { name: 'David', about: ['a', 'b'] };

    expect(renderTemplate({ source, context })).toBe(renderTemplate({ source, context }));
  });

  it('rejects invalid source or context', () => {
    expect(() => renderTemplate({ source: '   ', context: {} })).toThrow(TypeError);
    expect(() => renderTemplate({ source: 'Hello', context: null })).toThrow(TypeError);
  });
});
