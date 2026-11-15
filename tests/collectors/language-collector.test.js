import { describe, expect, it } from 'vitest';

import { collectLanguageStats, LanguageCollectionError } from '../../src/collectors/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { createApiFailure, createRequestRest } from '../helpers/fake-api.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

function createSettings(overrides = {}) {
  return {
    concurrency: 2,
    includePrivate: true,
    failurePolicy: 'fail',
    ...overrides,
  };
}

function repositoryMap(entries) {
  return {
    rest: createRequestRest((_route, { repo }) => {
      if (!(repo in entries)) throw new Error(`Unexpected repository in test: ${repo}`);
      return { data: entries[repo] };
    }),
  };
}

describe('collectLanguageStats', () => {
  it('collects multiple languages from public and private repositories', async () => {
    const { rest } = repositoryMap({
      'public-one': { JavaScript: 1000, CSS: 250 },
      'private-one': { Python: 500 },
    });

    const result = await collectLanguageStats({
      rest,
      repositories: [
        createRepository({ id: 1, name: 'public-one' }),
        createPrivateRepository({ id: 2, name: 'private-one' }),
      ],
      settings: createSettings(),
    });

    expect(result.collections).toEqual([
      { repositoryId: 1, private: false, languages: { JavaScript: 1000, CSS: 250 } },
      { repositoryId: 2, private: true, languages: { Python: 500 } },
    ]);
    expect(result.coverage).toMatchObject({
      requestedRepositoryCount: 2,
      collectedRepositoryCount: 2,
      failedRepositoryCount: 0,
      publicRepositoryCount: 1,
      privateRepositoryCount: 1,
      includesPrivate: true,
      complete: true,
    });
  });

  it('accepts empty language maps for zero-language repositories', async () => {
    const { rest } = repositoryMap({
      'empty-one': {},
      'empty-two': {},
    });

    const result = await collectLanguageStats({
      rest,
      repositories: [
        createRepository({ id: 1, name: 'empty-one', language: null }),
        createRepository({ id: 2, name: 'empty-two', language: null }),
      ],
      settings: createSettings(),
    });

    expect(
      result.collections.every((collection) => Object.keys(collection.languages).length === 0),
    ).toBe(true);
    expect(result.coverage.complete).toBe(true);
  });

  it('can exclude private repositories from language collection by configuration', async () => {
    const { rest } = repositoryMap({
      'public-one': { JavaScript: 10 },
    });

    const result = await collectLanguageStats({
      rest,
      repositories: [
        createRepository({ id: 1, name: 'public-one' }),
        createPrivateRepository({ id: 2, name: 'private-one' }),
      ],
      settings: createSettings({ includePrivate: false }),
    });

    expect(result.collections).toHaveLength(1);
    expect(result.coverage).toMatchObject({
      skippedPrivateRepositoryCount: 1,
      includesPrivate: false,
      privateCoverage: 'excluded-by-config',
      complete: true,
    });
    expect(rest.request).toHaveBeenCalledTimes(1);
  });

  it('records skipped 404 failures and marks the result incomplete', async () => {
    const rest = createRequestRest((_route, { repo }) => {
      if (repo === 'missing-one') {
        throw createApiFailure(404, {
          url: `https://api.github.com/repos/davidokothminyika-commits/${repo}/languages`,
        });
      }
      return { data: { JavaScript: 100 } };
    });

    const result = await collectLanguageStats({
      rest,
      repositories: [
        createRepository({ id: 1, name: 'public-one' }),
        createRepository({ id: 2, name: 'missing-one' }),
      ],
      settings: createSettings({ failurePolicy: 'skip' }),
    });

    expect(result.collections).toHaveLength(1);
    expect(result.failures).toEqual([
      { repositoryId: 2, private: false, code: 'GITHUB_NOT_FOUND', fatal: false },
    ]);
    expect(result.coverage).toMatchObject({ failedRepositoryCount: 1, complete: false });
  });

  it('records skipped 403 failures for inaccessible repositories', async () => {
    const rest = createRequestRest(() => {
      throw createApiFailure(403, {
        url: 'https://api.github.com/repos/davidokothminyika-commits/private-project/languages',
      });
    });

    const result = await collectLanguageStats({
      rest,
      repositories: [createPrivateRepository({ id: 1 })],
      settings: createSettings({ failurePolicy: 'skip' }),
    });

    expect(result.failures).toEqual([
      { repositoryId: 1, private: true, code: 'GITHUB_FORBIDDEN', fatal: false },
    ]);
    expect(result.collections).toEqual([]);
    expect(result.coverage.complete).toBe(false);
  });

  it('fails the collection under the default fail policy', async () => {
    const rest = createRequestRest(() => {
      throw createApiFailure(403);
    });

    await expect(
      collectLanguageStats({
        rest,
        repositories: [createPrivateRepository({ id: 1 })],
        settings: createSettings(),
      }),
    ).rejects.toMatchObject({
      name: 'LanguageCollectionError',
      code: 'LANGUAGE_COLLECTION_FAILED',
    });
  });

  it('treats rate limits as fatal even when failures may be skipped', async () => {
    const rest = createRequestRest(() => {
      throw createApiFailure(403, {
        url: 'https://api.github.com/repos/davidokothminyika-commits/private-project/languages',
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '9999999999' },
      });
    });

    let caught;
    try {
      await collectLanguageStats({
        rest,
        repositories: [createPrivateRepository({ id: 1, name: 'private-project' })],
        settings: createSettings({ failurePolicy: 'skip' }),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LanguageCollectionError);
    expect(caught.code).toBe('LANGUAGE_COLLECTION_ABORTED');
    expect(caught.message).not.toContain('private-project');
    expect(JSON.stringify(caught)).not.toContain('private-project');
  });

  it('treats authentication failures as fatal even when failures may be skipped', async () => {
    const rest = createRequestRest(() => {
      throw createApiFailure(401);
    });

    await expect(
      collectLanguageStats({
        rest,
        repositories: [createRepository({ id: 1 })],
        settings: createSettings({ failurePolicy: 'skip' }),
      }),
    ).rejects.toMatchObject({ code: 'LANGUAGE_COLLECTION_ABORTED' });
  });

  it('never treats a failed private request as an empty language map', async () => {
    const rest = createRequestRest(() => {
      throw createApiFailure(500);
    });

    await expect(
      collectLanguageStats({
        rest,
        repositories: [createPrivateRepository({ id: 1 })],
        settings: createSettings({ failurePolicy: 'skip' }),
      }),
    ).resolves.toMatchObject({
      collections: [],
      failures: [{ repositoryId: 1, private: true, code: 'GITHUB_SERVER_ERROR', fatal: false }],
    });
  });

  it('treats invalid byte counts as fatal malformed data', async () => {
    const rest = createRequestRest(() => ({ data: { JavaScript: -5 } }));

    await expect(
      collectLanguageStats({
        rest,
        repositories: [createRepository({ id: 1 })],
        settings: createSettings({ failurePolicy: 'skip' }),
      }),
    ).rejects.toMatchObject({ code: 'LANGUAGE_COLLECTION_ABORTED' });
  });

  it('honours the configured concurrency limit', async () => {
    let active = 0;
    let maximumActive = 0;
    const rest = createRequestRest(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { data: { JavaScript: 1 } };
    });

    const repositories = Array.from({ length: 6 }, (_, index) =>
      createRepository({ id: index + 1, name: `repo-${index + 1}` }),
    );

    await collectLanguageStats({
      rest,
      repositories,
      settings: createSettings({ concurrency: 2 }),
    });

    expect(maximumActive).toBe(2);
  });

  it('handles an empty repository list', async () => {
    const rest = createRequestRest(() => ({ data: {} }));

    const result = await collectLanguageStats({
      rest,
      repositories: [],
      settings: createSettings(),
    });

    expect(result.collections).toEqual([]);
    expect(result.coverage).toMatchObject({
      requestedRepositoryCount: 0,
      collectedRepositoryCount: 0,
      complete: true,
    });
  });

  it('does not log private repository names or URLs', async () => {
    const logs = [];
    const logger = createLogger({ level: 'debug', sink: (line) => logs.push(line) });
    const privateRepository = createPrivateRepository({
      id: 2,
      name: 'secret-project',
    });
    const rest = createRequestRest((_route, { repo }) => {
      if (repo === 'secret-project') {
        throw createApiFailure(404, {
          url: `https://api.github.com/repos/davidokothminyika-commits/${repo}/languages`,
        });
      }
      return { data: { JavaScript: 1 } };
    });

    await collectLanguageStats({
      rest,
      repositories: [createRepository({ id: 1 }), privateRepository],
      settings: createSettings({ failurePolicy: 'skip' }),
      logger,
    });

    const serialized = logs.join('\n');
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain(privateRepository.html_url);
  });

  it('validates its arguments', async () => {
    const rest = createRequestRest(() => ({ data: {} }));

    await expect(collectLanguageStats({})).rejects.toThrow(TypeError);
    await expect(
      collectLanguageStats({
        rest,
        repositories: [],
        settings: createSettings({ concurrency: 0 }),
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      collectLanguageStats({
        rest,
        repositories: [],
        settings: createSettings({ failurePolicy: 'ignore' }),
      }),
    ).rejects.toThrow(RangeError);
  });
});
