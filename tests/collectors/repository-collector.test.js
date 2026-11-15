import { describe, expect, it } from 'vitest';

import { GitHubApiError, GitHubResponseError, PaginationLimitError } from '../../src/api/index.js';
import {
  collectRepositoryInventory,
  RepositoryIdentityConflictError,
  RepositoryOwnershipError,
} from '../../src/collectors/index.js';
import { loadConfig } from '../../src/config/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { createApiFailure, createPagedRest } from '../helpers/fake-api.js';
import {
  createIdentity,
  createPrivateRepository,
  createRepository,
} from '../helpers/repository-fixture.js';

const baseCollection = structuredClone(loadConfig().collection);

function createCollection(overrides = {}) {
  return {
    ...baseCollection,
    ...overrides,
    pagination: { ...baseCollection.pagination, ...(overrides.pagination ?? {}) },
  };
}

function identityFor({ publicCount = 0, privateCount = 0 } = {}) {
  return createIdentity({
    publicRepositoryCount: publicCount,
    ownedPrivateRepositoryCount: privateCount,
    totalPrivateRepositoryCount: privateCount,
    privateRepositoryCount: privateCount,
  });
}

describe('collectRepositoryInventory', () => {
  it('collects public repositories and verifies public/private coverage', async () => {
    const { rest } = createPagedRest([
      [createRepository({ id: 1, name: 'alpha' }), createRepository({ id: 2, name: 'beta' })],
    ]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection(),
      identity: identityFor({ publicCount: 2 }),
    });

    expect(result.repositories).toHaveLength(2);
    expect(result.allRepositories).toHaveLength(2);
    expect(result.coverage).toMatchObject({
      pagesFetched: 1,
      discoveredRepositoryCount: 2,
      includedRepositoryCount: 2,
      publicCoverage: 'verified',
      privateCoverage: 'verified',
      complete: true,
    });
  });

  it('includes authorized private repositories and keeps them distinguishable', async () => {
    const { rest } = createPagedRest([
      [
        createRepository({ id: 1, name: 'public-one' }),
        createPrivateRepository({ id: 2, name: 'private-one' }),
      ],
    ]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection(),
      identity: identityFor({ publicCount: 1, privateCount: 1 }),
    });

    expect(result.repositories.map((repository) => repository.private)).toEqual([false, true]);
    expect(result.coverage.privateCoverage).toBe('verified');
    expect(result.coverage.privateRepositoryCount).toBe(1);
  });

  it('handles more than 100 repositories without truncation', async () => {
    const { rest } = createPagedRest([
      Array.from({ length: 100 }, (_, index) =>
        createRepository({ id: index + 1, name: `repo-${index + 1}` }),
      ),
      Array.from({ length: 3 }, (_, index) =>
        createRepository({ id: 101 + index, name: `repo-${101 + index}` }),
      ),
    ]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection({ pagination: { maxPages: 2 } }),
      identity: identityFor({ publicCount: 103 }),
    });

    expect(result.repositories).toHaveLength(103);
    expect(result.coverage.pagesFetched).toBe(2);
  });

  it('fails closed when pagination exceeds the configured limit', async () => {
    const { rest } = createPagedRest([
      [createRepository({ id: 1 })],
      [createRepository({ id: 2, name: 'second' })],
    ]);

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection({ pagination: { maxPages: 1 } }),
        identity: identityFor({ publicCount: 2 }),
      }),
    ).rejects.toBeInstanceOf(PaginationLimitError);
  });

  it('deduplicates repositories by immutable ID', async () => {
    const duplicate = createRepository({ id: 7, name: 'stable-name' });
    const { rest } = createPagedRest([[duplicate], [{ ...duplicate }]]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection(),
      identity: identityFor({ publicCount: 1 }),
    });

    expect(result.repositories).toHaveLength(1);
    expect(result.coverage.duplicateRepositoryCount).toBe(1);
  });

  it('rejects conflicting records for the same repository ID', async () => {
    const { rest } = createPagedRest([
      [createRepository({ id: 7, name: 'first-name' })],
      [createRepository({ id: 7, name: 'second-name' })],
    ]);

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection(),
        identity: identityFor({ publicCount: 1 }),
      }),
    ).rejects.toBeInstanceOf(RepositoryIdentityConflictError);
  });

  it('applies fork, archived and empty filters after coverage checks', async () => {
    const { rest } = createPagedRest([
      [
        createRepository({ id: 1, name: 'normal' }),
        createRepository({ id: 2, name: 'forked', fork: true }),
        createRepository({ id: 3, name: 'archived-one', archived: true }),
        createRepository({ id: 4, name: 'empty-one', size: 0, language: null }),
      ],
    ]);

    const filtered = await collectRepositoryInventory({
      rest,
      collection: createCollection({
        includeForks: false,
        includeArchived: false,
        includeEmpty: false,
      }),
      identity: identityFor({ publicCount: 4 }),
    });

    expect(filtered.repositories.map((repository) => repository.name)).toEqual(['normal']);
    expect(filtered.coverage.filters).toEqual({
      excludedByName: 0,
      excludedForks: 1,
      excludedArchived: 1,
      excludedEmpty: 1,
      included: 1,
    });

    const included = await collectRepositoryInventory({
      rest: createPagedRest([
        [
          createRepository({ id: 1, name: 'normal' }),
          createRepository({ id: 2, name: 'forked', fork: true }),
          createRepository({ id: 3, name: 'archived-one', archived: true }),
          createRepository({ id: 4, name: 'empty-one', size: 0, language: null }),
        ],
      ]).rest,
      collection: createCollection({
        includeForks: true,
        includeArchived: true,
        includeEmpty: true,
      }),
      identity: identityFor({ publicCount: 4 }),
    });

    expect(included.repositories).toHaveLength(4);
  });

  it('applies configured repository exclusions case-insensitively', async () => {
    const { rest } = createPagedRest([
      [createRepository({ id: 1, name: 'Keep-Me' }), createRepository({ id: 2, name: 'skip-me' })],
    ]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection({ excludeRepositories: ['SKIP-ME'] }),
      identity: identityFor({ publicCount: 2 }),
    });

    expect(result.repositories.map((repository) => repository.name)).toEqual(['Keep-Me']);
  });

  it('fails when the token cannot see every private repository', async () => {
    const { rest } = createPagedRest([
      [
        createRepository({ id: 1, name: 'public-one' }),
        createPrivateRepository({ id: 2, name: 'visible-private' }),
      ],
    ]);

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection(),
        identity: identityFor({ publicCount: 1, privateCount: 2 }),
      }),
    ).rejects.toMatchObject({ code: 'PRIVATE_REPOSITORY_COVERAGE_MISMATCH' });
  });

  it('fails closed when the private repository count cannot be established', async () => {
    const { rest } = createPagedRest([[createRepository({ id: 1 })]]);
    const identity = createIdentity({
      publicRepositoryCount: 1,
      ownedPrivateRepositoryCount: null,
      totalPrivateRepositoryCount: null,
      privateRepositoryCount: null,
    });

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection({ requirePrivateCoverage: true }),
        identity,
      }),
    ).rejects.toMatchObject({ code: 'PRIVATE_REPOSITORY_COVERAGE_UNVERIFIED' });

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection({ requirePrivateCoverage: false }),
      identity,
    });

    expect(result.coverage.privateCoverage).toBe('unverified-not-required');
  });

  it('skips private coverage checks when collecting public repositories only', async () => {
    const { rest } = createPagedRest([[createRepository({ id: 1 })]]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection({
        visibility: 'public',
        requirePrivateCoverage: false,
      }),
      identity: createIdentity({
        publicRepositoryCount: 1,
        ownedPrivateRepositoryCount: null,
      }),
    });

    expect(result.coverage.privateCoverage).toBe('not-collected');
  });

  it('collects private repositories only when configured', async () => {
    const { rest } = createPagedRest([
      [
        createPrivateRepository({ id: 1, name: 'private-one' }),
        createPrivateRepository({ id: 2, name: 'private-two' }),
      ],
    ]);

    const result = await collectRepositoryInventory({
      rest,
      collection: createCollection({
        visibility: 'private',
        requirePrivateCoverage: true,
        languages: { ...baseCollection.languages, includePrivate: true },
      }),
      identity: createIdentity({
        publicRepositoryCount: null,
        ownedPrivateRepositoryCount: 2,
      }),
    });

    expect(result.repositories).toHaveLength(2);
    expect(result.coverage.publicCoverage).toBe('not-collected');
    expect(result.coverage.privateCoverage).toBe('verified');
  });

  it('propagates permission failures without exposing repository URLs', async () => {
    const privateUrl = 'https://api.github.com/repos/davidokothminyika-commits/private-project';
    const { rest } = createPagedRest([], {
      throwOnIterator: createApiFailure(403, { url: privateUrl }),
    });

    let caught;
    try {
      await collectRepositoryInventory({
        rest,
        collection: createCollection(),
        identity: identityFor({ publicCount: 1 }),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubApiError);
    expect(caught.code).toBe('GITHUB_FORBIDDEN');
    expect(JSON.stringify(caught)).not.toContain('private-project');
    expect(JSON.stringify(caught)).not.toContain(privateUrl);
  });

  it('rejects malformed repository responses', async () => {
    const { rest } = createPagedRest([[{ id: 1, name: 'incomplete' }]]);

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection(),
        identity: identityFor({ publicCount: 1 }),
      }),
    ).rejects.toBeInstanceOf(GitHubResponseError);
  });

  it('rejects repositories not owned by the authenticated account', async () => {
    const { rest } = createPagedRest([
      [createRepository({ id: 1, owner: { login: 'someone-else' } })],
    ]);

    await expect(
      collectRepositoryInventory({
        rest,
        collection: createCollection(),
        identity: identityFor({ publicCount: 1 }),
      }),
    ).rejects.toBeInstanceOf(RepositoryOwnershipError);
  });

  it('does not log private repository names or URLs', async () => {
    const logs = [];
    const logger = createLogger({ level: 'debug', sink: (line) => logs.push(line) });
    const privateRepository = createPrivateRepository({
      id: 2,
      name: 'secret-project',
      description: 'Private description',
      topics: ['secret-topic'],
    });
    const { rest } = createPagedRest([[createRepository({ id: 1 }), privateRepository]]);

    await collectRepositoryInventory({
      rest,
      collection: createCollection(),
      identity: identityFor({ publicCount: 1, privateCount: 1 }),
      logger,
    });

    const serialized = logs.join('\n');
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain(privateRepository.html_url);
    expect(serialized).not.toContain('Private description');
    expect(serialized).not.toContain('secret-topic');
  });

  it('validates its arguments', async () => {
    const { rest } = createPagedRest([[]]);
    const collection = createCollection();
    const identity = identityFor({ publicCount: 0 });

    await expect(collectRepositoryInventory({})).rejects.toThrow(TypeError);
    await expect(collectRepositoryInventory({ rest, collection, identity: null })).rejects.toThrow(
      TypeError,
    );
    await expect(collectRepositoryInventory({ rest, collection: null, identity })).rejects.toThrow(
      TypeError,
    );
  });
});
