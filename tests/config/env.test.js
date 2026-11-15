import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/schemas/env.schema.js';

describe('parseEnv', () => {
  it('applies safe defaults', () => {
    const env = parseEnv({});

    expect(env.LOG_LEVEL).toBe('info');
    expect(env.DRY_RUN).toBe(false);
    expect(env.PROFILE_GITHUB_TOKEN).toBeUndefined();
  });

  it('accepts a configured token without transforming it', () => {
    const token = 'github_pat_1234567890abcdefghijklmnopqrstuvwxyz';
    const env = parseEnv({ PROFILE_GITHUB_TOKEN: token });

    expect(env.PROFILE_GITHUB_TOKEN).toBe(token);
  });

  it('treats an empty token as not configured', () => {
    expect(parseEnv({ PROFILE_GITHUB_TOKEN: '   ' }).PROFILE_GITHUB_TOKEN).toBeUndefined();
  });

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['off', false],
  ])('parses DRY_RUN=%s as %s', (raw, expected) => {
    expect(parseEnv({ DRY_RUN: raw }).DRY_RUN).toBe(expected);
  });

  it('normalises the log level', () => {
    expect(parseEnv({ LOG_LEVEL: ' DEBUG ' }).LOG_LEVEL).toBe('debug');
  });

  it('rejects unknown log levels', () => {
    expect(() => parseEnv({ LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('rejects malformed repository identifiers', () => {
    expect(() => parseEnv({ GITHUB_REPOSITORY: 'not-a-repository' })).toThrow(/GITHUB_REPOSITORY/);
  });

  it('does not echo short token values in validation errors', () => {
    const secret = 'short-secret-value';
    let message = '';

    try {
      parseEnv({ PROFILE_GITHUB_TOKEN: secret });
    } catch (error) {
      message = String(error);
    }

    expect(message).toContain('PROFILE_GITHUB_TOKEN');
    expect(message).not.toContain(secret);
  });
});
