import { describe, expect, it } from 'vitest';

import { isSafeRelativePath, PathSafetyError, resolveWithin } from '../../src/utils/paths.js';

describe('isSafeRelativePath', () => {
  it.each(['README.md', 'assets/3d/profile.svg', 'config/profile.json'])(
    'accepts relative path %s',
    (candidate) => {
      expect(isSafeRelativePath(candidate)).toBe(true);
    },
  );

  it.each([
    ['absolute POSIX path', '/tmp/README.md'],
    ['absolute Windows path', 'C:\\temp\\README.md'],
    ['UNC-like Windows path', '\\\\server\\share\\file'],
    ['parent traversal', '../README.md'],
    ['nested parent traversal', 'assets/../../README.md'],
    ['Windows traversal', 'assets\\..\\..\\README.md'],
    ['home expansion', '~/README.md'],
    ['current directory segment', './README.md'],
    ['empty string', ''],
    ['whitespace', '   '],
    ['null byte', 'assets/\0file.svg'],
    ['non-string', 42],
  ])('rejects %s', (_label, candidate) => {
    expect(isSafeRelativePath(candidate)).toBe(false);
  });
});

describe('resolveWithin', () => {
  it('resolves paths inside the project root', () => {
    expect(resolveWithin('/srv/profile', 'assets/3d/chart.svg')).toBe(
      '/srv/profile/assets/3d/chart.svg',
    );
  });

  it('rejects escape attempts with PathSafetyError', () => {
    expect(() => resolveWithin('/srv/profile', '../outside.svg')).toThrow(PathSafetyError);
    expect(() => resolveWithin('/srv/profile', '/etc/passwd')).toThrow(PathSafetyError);
    expect(() => resolveWithin('/srv/profile', '.')).toThrow(PathSafetyError);
    expect(() => resolveWithin('/srv/profile', '')).toThrow(PathSafetyError);
  });
});
