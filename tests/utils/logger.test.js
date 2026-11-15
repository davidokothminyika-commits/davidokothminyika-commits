import { describe, expect, it } from 'vitest';

import { createLogger, silentLogger } from '../../src/utils/logger.js';

function capture() {
  const lines = [];
  return {
    lines,
    sink: (line) => lines.push(JSON.parse(line)),
  };
}

describe('createLogger', () => {
  it('filters records below the configured level', () => {
    const { lines, sink } = capture();
    const logger = createLogger({ level: 'warn', sink });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warning');
    logger.error('failure');

    expect(lines.map((line) => line.level)).toEqual(['warn', 'error']);
  });

  it('writes structured records with redacted context', () => {
    const { lines, sink } = capture();
    const logger = createLogger({ level: 'debug', sink });

    logger.error('Request failed', {
      authorization: 'token abc',
      nested: { token: `github_pat_${'z'.repeat(36)}`, safe: 'yes' },
    });

    expect(lines[0]).toMatchObject({
      level: 'error',
      message: 'Request failed',
      context: {
        authorization: '[REDACTED]',
        nested: { token: '[REDACTED]', safe: 'yes' },
      },
    });
    expect(lines[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('redacts tokens embedded in messages', () => {
    const { lines, sink } = capture();
    const logger = createLogger({ sink });

    logger.info(`token github_pat_${'q'.repeat(36)}`);

    expect(lines[0].message).not.toContain('github_pat_');
  });

  it('merges child bindings and lets call context override them', () => {
    const { lines, sink } = capture();
    const logger = createLogger({ sink }).child({ component: 'api', attempt: 1 });

    logger.warn('retry', { attempt: 2 });

    expect(lines[0].context).toEqual({ component: 'api', attempt: 2 });
  });

  it('rejects invalid log levels', () => {
    expect(() => createLogger({ level: 'verbose' })).toThrow(/Invalid log level/);
  });

  it('provides a no-op silent logger', () => {
    expect(() => silentLogger.info('ignored')).not.toThrow();
    expect(silentLogger.child({ any: 'context' })).toBe(silentLogger);
  });
});
