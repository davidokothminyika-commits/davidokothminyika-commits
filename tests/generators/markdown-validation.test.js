import { describe, expect, it } from 'vitest';

import { validateMarkdown } from '../../src/generators/index.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

describe('validateMarkdown', () => {
  it('accepts a well-formed generated README', () => {
    const result = validateMarkdown({
      markdown:
        '# David Okoth Minyika\n\nMy name is David Okoth Minyika and today is Sunday 15 November.\n',
      repositories: [createRepository()],
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty markdown', () => {
    expect(validateMarkdown({ markdown: '   ', repositories: [] })).toEqual({
      valid: false,
      errors: ['Generated README must be a non-empty Markdown string'],
    });
  });

  it('rejects markdown without a trailing newline', () => {
    const result = validateMarkdown({ markdown: '# Hello', repositories: [] });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Generated README must end with a newline');
  });

  it('rejects unresolved template placeholders', () => {
    const result = validateMarkdown({ markdown: '# Hello {{name}}', repositories: [] });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Generated README must not contain unresolved template placeholders',
    );
  });

  it('fails closed when markdown would leak a private repository identifier', () => {
    const privateRepository = createPrivateRepository({ id: 9001, name: 'secret-project' });

    const result = validateMarkdown({
      markdown: `# Hello ${privateRepository.full_name}\n`,
      repositories: [createRepository(), privateRepository],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Generated README failed the private-repository leak gate');
  });
});
