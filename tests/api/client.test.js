import { describe, expect, it } from 'vitest';

import {
  createGitHubClients,
  createGitHubClientsFromEnv,
  DEFAULT_USER_AGENT,
  GITHUB_API_VERSION,
  GitHubApiError,
  GitHubAuthenticationError,
  MissingTokenError,
  verifyAuthenticatedUser,
} from '../../src/api/index.js';
import { createLogger } from '../../src/utils/logger.js';
import {
  createFetchMock,
  createUser,
  createViewer,
  githubFetchHandler,
  jsonResponse,
  TEST_TOKEN,
} from '../helpers/github-fetch.js';

function createTestClients(handler, options = {}) {
  const fetchImplementation = createFetchMock(handler);
  const clients = createGitHubClients({
    token: TEST_TOKEN,
    fetchImplementation,
    requestRetries: 0,
    ...options,
  });
  return { clients, fetchImplementation };
}

describe('createGitHubClients', () => {
  it('requires a token', () => {
    expect(() => createGitHubClients()).toThrow(MissingTokenError);
    expect(() => createGitHubClients({ token: '   ' })).toThrow(/PROFILE_GITHUB_TOKEN/);
  });

  it('reads PROFILE_GITHUB_TOKEN from an injected environment', () => {
    const fetchImplementation = createFetchMock(() => jsonResponse({}));
    const clients = createGitHubClientsFromEnv({
      environment: { PROFILE_GITHUB_TOKEN: TEST_TOKEN },
      fetchImplementation,
      requestRetries: 0,
    });

    expect(clients.rest).toBeDefined();
    expect(clients.graphql).toBeTypeOf('function');
    expect(() =>
      createGitHubClientsFromEnv({
        environment: {},
        fetchImplementation,
      }),
    ).toThrow(MissingTokenError);
  });

  it('rejects invalid retry configurations', () => {
    expect(() => createGitHubClients({ token: TEST_TOKEN, requestRetries: -1 })).toThrow(
      RangeError,
    );
    expect(() => createGitHubClients({ token: TEST_TOKEN, requestRetries: 2.5 })).toThrow(
      RangeError,
    );
  });

  it('does not expose the token as a client property', () => {
    const { clients } = createTestClients(githubFetchHandler());
    const serialized = JSON.stringify(Object.keys(clients));

    expect(serialized).not.toContain(TEST_TOKEN);
    expect(Object.keys(clients).sort()).toEqual(['graphql', 'rest']);
  });
});

describe('verifyAuthenticatedUser', () => {
  it('verifies REST and GraphQL identity and returns a safe summary', async () => {
    const { clients, fetchImplementation } = createTestClients(githubFetchHandler());
    const logs = [];
    const logger = createLogger({
      level: 'info',
      sink: (line) => logs.push(JSON.parse(line)),
    });

    const identity = await verifyAuthenticatedUser(clients, {
      expectedLogin: 'DAVIDOKOTHMINYIKA-COMMITS',
      logger,
    });

    expect(identity).toEqual({
      login: 'davidokothminyika-commits',
      id: 238948285,
      name: 'David Okoth Minyika',
      type: 'User',
      publicRepositoryCount: 7,
      ownedPrivateRepositoryCount: 2,
      totalPrivateRepositoryCount: 2,
      privateRepositoryCount: 2,
      followers: 0,
      following: 3,
      tokenKind: 'classic',
      scopes: ['read:user', 'repo'],
    });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.isFrozen(identity.scopes)).toBe(true);

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const [restCall, graphqlCall] = fetchImplementation.mock.calls;
    expect(restCall[0]).toBe('https://api.github.com/user');
    expect(restCall[1].headers.authorization).toBe(`token ${TEST_TOKEN}`);
    expect(restCall[1].headers['x-github-api-version']).toBe(GITHUB_API_VERSION);
    expect(restCall[1].headers['user-agent']).toContain(DEFAULT_USER_AGENT);

    expect(graphqlCall[0]).toBe('https://api.github.com/graphql');
    expect(graphqlCall[1].headers.authorization).toBe(`token ${TEST_TOKEN}`);
    expect(JSON.parse(graphqlCall[1].body).query).toContain('viewer');

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Authenticated GitHub account verified.');
    expect(logs[0].context).toEqual({
      login: 'davidokothminyika-commits',
      accountType: 'User',
      tokenKind: 'classic',
      scopeCount: 2,
    });
    expect(JSON.stringify(logs)).not.toContain(TEST_TOKEN);
    expect(logs[0].context).not.toHaveProperty('privateRepositoryCount');
  });

  it('prefers the owned private repository count for coverage checks', async () => {
    const { clients } = createTestClients(
      githubFetchHandler({
        user: createUser({ total_private_repos: 9, owned_private_repos: 2 }),
      }),
    );

    const identity = await verifyAuthenticatedUser(clients, {
      expectedLogin: 'davidokothminyika-commits',
    });

    expect(identity.ownedPrivateRepositoryCount).toBe(2);
    expect(identity.totalPrivateRepositoryCount).toBe(9);
    expect(identity.privateRepositoryCount).toBe(2);
  });

  it('falls back to the total private count when the owned count is absent', async () => {
    const user = createUser({ total_private_repos: 3 });
    delete user.owned_private_repos;
    const { clients } = createTestClients(githubFetchHandler({ user }));

    const identity = await verifyAuthenticatedUser(clients, {
      expectedLogin: 'davidokothminyika-commits',
    });

    expect(identity.ownedPrivateRepositoryCount).toBeNull();
    expect(identity.totalPrivateRepositoryCount).toBe(3);
    expect(identity.privateRepositoryCount).toBe(3);
  });

  it('rejects a token that belongs to another account before calling GraphQL', async () => {
    const { clients, fetchImplementation } = createTestClients(
      githubFetchHandler({ user: createUser({ login: 'someone-else' }) }),
    );

    await expect(
      verifyAuthenticatedUser(clients, { expectedLogin: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({
      name: 'GitHubAuthenticationError',
      code: 'GITHUB_LOGIN_MISMATCH',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('rejects organization accounts', async () => {
    const { clients } = createTestClients(
      githubFetchHandler({ user: createUser({ type: 'Organization' }) }),
    );

    await expect(
      verifyAuthenticatedUser(clients, { expectedLogin: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_NOT_A_USER_ACCOUNT' });
  });

  it('rejects mismatched REST and GraphQL identities', async () => {
    const { clients } = createTestClients(
      githubFetchHandler({
        viewer: createViewer({ login: 'other-user', databaseId: 42 }),
      }),
    );

    await expect(
      verifyAuthenticatedUser(clients, { expectedLogin: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_IDENTITY_MISMATCH' });
  });

  it('rejects malformed REST identity responses', async () => {
    const { clients } = createTestClients(() => jsonResponse({ login: 'incomplete' }));

    await expect(
      verifyAuthenticatedUser(clients, { expectedLogin: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_RESPONSE' });
  });

  it('rejects malformed GraphQL viewer responses', async () => {
    const fetchImplementation = createFetchMock(({ url }) => {
      if (url.endsWith('/user')) return jsonResponse(createUser());
      return jsonResponse({ data: { viewer: { login: 'x' } } });
    });
    const clients = createGitHubClients({
      token: TEST_TOKEN,
      fetchImplementation,
      requestRetries: 0,
    });

    await expect(
      verifyAuthenticatedUser(clients, { expectedLogin: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_RESPONSE' });
  });

  it('normalizes a GraphQL authentication failure without leaking the token', async () => {
    const { clients } = createTestClients(githubFetchHandler({ graphqlStatus: 401 }));

    let caught;
    try {
      await verifyAuthenticatedUser(clients, {
        expectedLogin: 'davidokothminyika-commits',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubApiError);
    expect(caught.code).toBe('GITHUB_AUTHENTICATION_FAILED');
    expect(caught.operation).toBe('authenticated GraphQL viewer lookup');
    expect(String(caught.message)).not.toContain(TEST_TOKEN);
    expect(JSON.stringify(caught)).not.toContain(TEST_TOKEN);
  });

  it('requires an expected login', async () => {
    const { clients } = createTestClients(githubFetchHandler());

    await expect(verifyAuthenticatedUser(clients, {})).rejects.toThrow(TypeError);
  });

  it('marks fine-grained tokens from response metadata', async () => {
    const fetchImplementation = createFetchMock(({ url }) => {
      if (url.endsWith('/user')) {
        return jsonResponse(createUser(), {
          headers: {
            'x-accepted-github-permissions': 'metadata=read;contents=read',
          },
        });
      }
      return jsonResponse({ data: { viewer: createViewer() } });
    });
    const clients = createGitHubClients({
      token: TEST_TOKEN,
      fetchImplementation,
      requestRetries: 0,
    });

    const identity = await verifyAuthenticatedUser(clients, {
      expectedLogin: 'davidokothminyika-commits',
    });

    expect(identity.tokenKind).toBe('fine-grained');
    expect(identity.scopes).toEqual([]);
  });

  it('does not print token or private counts through the logger on success', async () => {
    const logs = [];
    const logger = createLogger({ level: 'debug', sink: (line) => logs.push(line) });
    const { clients } = createTestClients(githubFetchHandler());

    await verifyAuthenticatedUser(clients, {
      expectedLogin: 'davidokothminyika-commits',
      logger,
    });

    expect(logs.join('\n')).not.toContain(TEST_TOKEN);
    expect(logs.join('\n')).not.toContain('privateRepositoryCount');
  });
});

describe('GitHubAuthenticationError', () => {
  it('has a stable name and code', () => {
    const error = new GitHubAuthenticationError('test', { code: 'TEST_CODE' });
    expect(error.name).toBe('GitHubAuthenticationError');
    expect(error.code).toBe('TEST_CODE');
  });
});
