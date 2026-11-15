import { describe, expect, it } from 'vitest';

import {
  createGitHubClients,
  GitHubResponseError,
  listOwnedRepositories,
  PaginationLimitError,
} from '../../src/api/index.js';
import { createFetchMock, jsonResponse, TEST_TOKEN } from '../helpers/github-fetch.js';
import { createRepository } from '../helpers/repository-fixture.js';

function createClient(pages) {
  const fetchImplementation = createFetchMock(({ url }) => {
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get('page') ?? '1');
    const items = pages[page - 1] ?? [];
    const headers =
      page < pages.length
        ? {
            link: `<https://api.github.com/user/repos?page=${page + 1}&per_page=100>; rel="next"`,
          }
        : {};

    return jsonResponse(items, { headers });
  });

  return {
    clients: createGitHubClients({
      token: TEST_TOKEN,
      fetchImplementation,
      requestRetries: 0,
    }),
    fetchImplementation,
  };
}

describe('listOwnedRepositories', () => {
  it('enumerates owned repositories with the configured scope and pagination', async () => {
    const richRepository = {
      ...createRepository({ id: 1, name: 'alpha' }),
      node_id: 'R_kgDOExample',
      license: { key: 'mit' },
      permissions: { admin: false, push: true },
    };
    richRepository.owner = {
      login: 'davidokothminyika-commits',
      id: 238948285,
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    };
    const pages = [
      [richRepository, createRepository({ id: 2, name: 'beta' })],
      [createRepository({ id: 3, name: 'gamma' })],
    ];
    const { clients, fetchImplementation } = createClient(pages);

    const result = await listOwnedRepositories({
      octokit: clients.rest,
      visibility: 'all',
      perPage: 100,
      maxPages: 3,
    });

    expect(result.pages).toBe(2);
    expect(result.repositories.map((repository) => repository.id)).toEqual([1, 2, 3]);
    expect(result.repositories[0]).not.toHaveProperty('node_id');
    expect(result.repositories[0]).not.toHaveProperty('permissions');
    expect(result.repositories[0].owner).toEqual({ login: 'davidokothminyika-commits' });

    const firstUrl = new URL(fetchImplementation.mock.calls[0][0]);
    expect(firstUrl.pathname).toBe('/user/repos');
    expect(firstUrl.searchParams.get('affiliation')).toBe('owner');
    expect(firstUrl.searchParams.get('visibility')).toBe('all');
    expect(firstUrl.searchParams.get('sort')).toBe('full_name');
    expect(firstUrl.searchParams.get('direction')).toBe('asc');
    expect(firstUrl.searchParams.get('per_page')).toBe('100');
  });

  it('collects more than 100 repositories across pages', async () => {
    const pages = [
      Array.from({ length: 100 }, (_, index) =>
        createRepository({ id: index + 1, name: `repo-${index + 1}` }),
      ),
      Array.from({ length: 7 }, (_, index) =>
        createRepository({ id: 101 + index, name: `repo-${101 + index}` }),
      ),
    ];
    const { clients } = createClient(pages);

    const result = await listOwnedRepositories({ octokit: clients.rest, maxPages: 2 });

    expect(result.pages).toBe(2);
    expect(result.repositories).toHaveLength(107);
  });

  it('accepts an empty repository list', async () => {
    const { clients } = createClient([[]]);

    const result = await listOwnedRepositories({ octokit: clients.rest, maxPages: 1 });

    expect(result.repositories).toEqual([]);
    expect(result.pages).toBe(1);
  });

  it('fails closed when the configured page cap is exhausted', async () => {
    const pages = [
      [createRepository({ id: 1 })],
      [createRepository({ id: 2, name: 'second' })],
      [createRepository({ id: 3, name: 'third' })],
    ];
    const { clients } = createClient(pages);

    await expect(
      listOwnedRepositories({ octokit: clients.rest, maxPages: 2 }),
    ).rejects.toBeInstanceOf(PaginationLimitError);
  });

  it('rejects malformed repository records without exposing their values', async () => {
    const { clients } = createClient([[{ id: 'not-a-number', name: 'private-repo' }]]);

    let caught;
    try {
      await listOwnedRepositories({ octokit: clients.rest, maxPages: 1 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubResponseError);
    expect(caught.code).toBe('GITHUB_INVALID_REPOSITORY_RESPONSE');
    expect(caught.message).not.toContain('private-repo');
  });

  it('validates arguments before requesting GitHub', async () => {
    const { clients, fetchImplementation } = createClient([[]]);

    await expect(
      listOwnedRepositories({ octokit: clients.rest, visibility: 'team' }),
    ).rejects.toThrow(RangeError);
    await expect(listOwnedRepositories({ octokit: clients.rest, perPage: 101 })).rejects.toThrow(
      RangeError,
    );
    await expect(listOwnedRepositories({ octokit: clients.rest, maxPages: 0 })).rejects.toThrow(
      RangeError,
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
