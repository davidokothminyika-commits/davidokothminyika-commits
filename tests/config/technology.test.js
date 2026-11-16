import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.js';
import { createConfigFixture } from '../helpers/config-fixture.js';

function withMutatedProfile(mutate, assertions) {
  const fixture = createConfigFixture(mutate);
  try {
    assertions(() => loadConfig({ rootDir: fixture.root }));
  } finally {
    fixture.cleanup();
  }
}

describe('technology configuration schema', () => {
  it('rejects unsupported Skill Icons identifiers', () => {
    withMutatedProfile(
      (documents) => {
        documents.profile.technology[0].items[0].icon = 'unsupported';
      },
      (load) => expect(() => load()).toThrow(),
    );
  });

  it('rejects URL injection attempts as identifiers', () => {
    for (const icon of ['https://evil.example/x', 'nodejs&theme=dark&perline=1', 'a b c']) {
      withMutatedProfile(
        (documents) => {
          documents.profile.technology[0].items[0].icon = icon;
        },
        (load) => expect(() => load()).toThrow(),
      );
    }
  });

  it('rejects invalid perline values', () => {
    for (const perline of [0, 11, -1, 2.5, '3']) {
      withMutatedProfile(
        (documents) => {
          documents.profile.technology[0].perline = perline;
        },
        (load) => expect(() => load()).toThrow(),
      );
    }
  });

  it('applies a deterministic perline default when omitted', () => {
    withMutatedProfile(
      (documents) => {
        delete documents.profile.technology[0].perline;
      },
      (load) => expect(load().profile.technology[0].perline).toBe(10),
    );
  });

  it('rejects duplicate technologies declared across groups', () => {
    withMutatedProfile(
      (documents) => {
        documents.profile.technology[1].items[0] = { name: 'Node.js', icon: 'nodejs' };
      },
      (load) => expect(() => load()).toThrow(/Duplicate technology/),
    );
  });

  it('rejects overly long or empty group names', () => {
    withMutatedProfile(
      (documents) => {
        documents.profile.technology[0].group = '';
      },
      (load) => expect(() => load()).toThrow(),
    );
  });

  it('accepts the committed configuration and exposes icon identifiers', () => {
    const config = loadConfig();
    const groups = config.profile.technology;

    expect(groups).toHaveLength(3);
    expect(groups[0].items.map((item) => item.icon)).toEqual(['nodejs', 'express', 'mysql']);
    expect(groups[1].items.map((item) => item.icon)).toEqual(['react', 'js', 'html']);
    expect(groups[2].items.map((item) => item.icon)).toEqual([
      'kotlin',
      'bash',
      'git',
      'githubactions',
      'vscode',
    ]);
    expect(groups[2].perline).toBe(5);
  });
});
