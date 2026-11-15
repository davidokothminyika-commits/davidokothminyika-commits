import { describe, expect, it } from 'vitest';

import { redactSecrets, redactString } from '../../src/utils/redact.js';

const TOKEN = `github_pat_${'x'.repeat(36)}`;

describe('redactString', () => {
  it('redacts GitHub token formats', () => {
    expect(redactString(`token=${TOKEN}`)).not.toContain(TOKEN);
    expect(redactString(`use ghp_${'a'.repeat(36)} now`)).not.toContain('ghp_');
    expect(redactString(`Bearer abc.def.ghi`)).toBe('[REDACTED]');
  });

  it('redacts authorization assignments while preserving the key', () => {
    expect(redactString('authorization: token secret123')).toBe('authorization: [REDACTED]');
    expect(redactString('{"authorization":"token abc"}')).toContain('[REDACTED]');
  });

  it('leaves ordinary messages intact', () => {
    expect(redactString('Collected 14 repositories')).toBe('Collected 14 repositories');
  });
});

describe('redactSecrets', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      safe: 'value',
      authorization: 'token abc',
      nested: {
        apiKey: 'key',
        client_secret: 'secret',
        token: TOKEN,
        list: [{ password: 'pw' }],
      },
    };

    const output = redactSecrets(input);

    expect(output).toEqual({
      safe: 'value',
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        client_secret: '[REDACTED]',
        token: '[REDACTED]',
        list: [{ password: '[REDACTED]' }],
      },
    });
    expect(input.nested.token).toBe(TOKEN);
  });

  it('does not redact benign metadata whose name merely starts with token', () => {
    expect(
      redactSecrets({
        tokenKind: 'classic',
        tokenType: 'fine-grained',
        tokenCount: 3,
        tokenExpiresAt: '2027-01-01',
        accessToken: 'secret',
      }),
    ).toEqual({
      tokenKind: 'classic',
      tokenType: 'fine-grained',
      tokenCount: 3,
      tokenExpiresAt: '2027-01-01',
      accessToken: '[REDACTED]',
    });
  });

  it('redacts tokens embedded in strings', () => {
    expect(redactSecrets({ message: `failed with ${TOKEN}` })).toEqual({
      message: 'failed with [REDACTED]',
    });
  });

  it('serializes errors without stacks', () => {
    const error = new Error(`bad token ${TOKEN}`);
    error.stack = `stack ${TOKEN}`;

    expect(redactSecrets(error)).toEqual({
      name: 'Error',
      message: 'bad token [REDACTED]',
    });
  });

  it('handles arrays, dates, primitives, null and cycles', () => {
    const cyclic = { name: 'cycle' };
    cyclic.self = cyclic;

    expect(redactSecrets([1, 'two', null, undefined, true])).toEqual([
      1,
      'two',
      null,
      undefined,
      true,
    ]);
    expect(redactSecrets({ date: new Date('2026-01-02T03:04:05Z') })).toEqual({
      date: '2026-01-02T03:04:05.000Z',
    });
    expect(redactSecrets(cyclic)).toEqual({ name: 'cycle', self: '[Circular]' });
    expect(redactSecrets(42)).toBe(42);
  });
});
