import { describe, expect, it } from 'vitest';

import { GitHubApiError, normalizeApiError } from '../../src/api/index.js';

function httpError(status, { headers = {}, data = {}, message = 'request failed' } = {}) {
  return Object.assign(new Error(message), {
    status,
    response: { status, headers, data },
  });
}

describe('normalizeApiError', () => {
  it('returns an existing safe error unchanged', () => {
    const original = new GitHubApiError('already safe');
    expect(normalizeApiError(original)).toBe(original);
  });

  it('maps authentication failures to an actionable message', () => {
    const error = normalizeApiError(httpError(401, { message: 'Bad credentials' }), {
      operation: 'authenticated user lookup',
    });

    expect(error).toMatchObject({
      code: 'GITHUB_AUTHENTICATION_FAILED',
      status: 401,
      operation: 'authenticated user lookup',
    });
    expect(error.message).toContain('PROFILE_GITHUB_TOKEN');
  });

  it('maps rate limits and preserves retry-after metadata', () => {
    const error = normalizeApiError(
      httpError(403, {
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0',
          'x-github-request-id': 'REQ-1',
        },
      }),
      { operation: 'repository metadata collection' },
    );

    expect(error).toMatchObject({
      code: 'GITHUB_RATE_LIMITED',
      status: 403,
      retryAfter: 60,
      requestId: 'REQ-1',
    });
  });

  it('maps remaining-quota rate limits using the reset timestamp', () => {
    const reset = Math.ceil(Date.now() / 1000) + 120;
    const error = normalizeApiError(
      httpError(429, {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(reset),
        },
      }),
    );

    expect(error.code).toBe('GITHUB_RATE_LIMITED');
    expect(error.retryAfter).toBeGreaterThan(100);
  });

  it('maps forbidden, not-found and server failures', () => {
    expect(normalizeApiError(httpError(403)).code).toBe('GITHUB_FORBIDDEN');
    expect(normalizeApiError(httpError(404)).code).toBe('GITHUB_NOT_FOUND');
    expect(normalizeApiError(httpError(502)).code).toBe('GITHUB_SERVER_ERROR');
  });

  it('maps unknown HTTP failures without echoing raw error messages', () => {
    const privateName = 'secret-repository';
    const error = normalizeApiError(
      httpError(422, {
        message: `Validation failed for https://api.github.com/repos/owner/${privateName}`,
      }),
      { operation: 'repository collection' },
    );

    expect(error.code).toBe('GITHUB_API_ERROR');
    expect(error.message).not.toContain(privateName);
  });

  it('maps network failures without echoing URLs or response data', () => {
    const error = normalizeApiError(
      new TypeError('fetch failed for https://api.github.com/repos/owner/private-name'),
      { operation: 'contribution collection' },
    );

    expect(error.code).toBe('GITHUB_NETWORK_ERROR');
    expect(error.message).not.toContain('private-name');
    expect(error.message).toContain('contribution collection');
  });

  it('maps untyped GraphQL validation failures to a distinct code', () => {
    const privateName = 'secret-repository';
    const raw = {
      name: 'GraphqlResponseError',
      headers: { 'x-github-request-id': 'GQL-REQUEST' },
      errors: [
        {
          message: `Cannot query field 'totalContributions' on type 'ContributionsCollection': ${privateName}`,
          extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
        },
      ],
      data: { repository: { name: privateName } },
    };

    const error = normalizeApiError(raw, { operation: 'contribution collection' });

    expect(error).toMatchObject({
      code: 'GITHUB_GRAPHQL_VALIDATION',
      requestId: 'GQL-REQUEST',
    });
    expect(error.message).toContain('contribution collection');
    expect(error.message).toContain('GRAPHQL_VALIDATION_FAILED');
    expect(error.message).not.toContain(privateName);
    expect(error.message).not.toContain("totalContributions'");
    expect(JSON.stringify(error)).not.toContain(privateName);
  });

  it('maps GraphQL syntax failures to the same distinct code', () => {
    const raw = {
      name: 'GraphqlResponseError',
      headers: {},
      errors: [{ message: 'Field is not reachable', extensions: { code: 'GRAPHQL_PARSE_FAILED' } }],
    };

    const error = normalizeApiError(raw, { operation: 'contribution collection' });

    expect(error).toMatchObject({ code: 'GITHUB_GRAPHQL_VALIDATION' });
  });

  it('maps GraphQL error types without echoing server messages', () => {
    const privateName = 'secret-repository';
    const raw = {
      name: 'GraphqlResponseError',
      status: 200,
      headers: { 'x-github-request-id': 'GQL-REQUEST' },
      errors: [
        {
          type: 'FORBIDDEN',
          message: `Resource not accessible by integration: ${privateName}`,
        },
        {
          type: 'FORBIDDEN',
          message: 'duplicate type',
        },
        {
          type: 'NOT_FOUND',
          message: `Could not resolve ${privateName}`,
        },
      ],
      data: { repository: { name: privateName } },
    };

    const error = normalizeApiError(raw, { operation: 'contribution calendar collection' });

    expect(error).toMatchObject({
      code: 'GITHUB_GRAPHQL_ERROR',
      requestId: 'GQL-REQUEST',
    });
    expect(error.message).toContain('FORBIDDEN');
    expect(error.message).toContain('NOT_FOUND');
    expect(error.message).not.toContain(privateName);
    expect(JSON.stringify(error)).not.toContain(privateName);
  });

  it('allows only GitHub documentation links through', () => {
    const safe = normalizeApiError(
      httpError(404, {
        data: { documentation_url: 'https://docs.github.com/en/rest' },
      }),
    );
    const unsafe = normalizeApiError(
      httpError(404, {
        data: { documentation_url: 'https://example.com/private' },
      }),
    );

    expect(safe.documentationUrl).toBe('https://docs.github.com/en/rest');
    expect(unsafe.documentationUrl).toBeNull();
  });

  it('serializes only safe metadata through toJSON', () => {
    const error = normalizeApiError(
      httpError(403, {
        headers: { 'x-github-request-id': 'REQ-2' },
        data: { message: 'private details' },
      }),
    );

    expect(error.toJSON()).toEqual({
      name: 'GitHubApiError',
      code: 'GITHUB_FORBIDDEN',
      message: expect.any(String),
      status: 403,
      requestId: 'REQ-2',
      documentationUrl: null,
      retryAfter: null,
      operation: 'GitHub API request',
    });
  });
});
