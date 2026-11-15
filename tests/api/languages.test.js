import { describe, expect, it } from 'vitest';

import {
  createGitHubClients,
  fetchRepositoryLanguages,
  GitHubApiError,
  GitHubResponseError,
} from '../../src/api/index.js';
import { createApiFailure } from '../helpers/fake-api.js';
import { createFetchMock, jsonResponse, TEST_TOKEN } from '../helpers/github-fetch.js';

function createClient(body, options = {}) {
  const fetchImplementation = createFetchMock(({ url }) => {
    if (url.endsWith('/languages')) return jsonResponse(body, options);
    throw new Error(`Unexpected fetch URL in test: ${url}`);
  });

  const clients = createGitHubClients({
    token: TEST_TOKEN,
    fetchImplementation,
    requestRetries: 0,
  });

  return { clients, fetchImplementation };
}

function failingClient(error) {
  return { request: async () => Promise.reject(error) };
}

describe('fetchRepositoryLanguages', () => {
  it('returns validated language byte counts', async () => {
    const { clients, fetchImplementation } = createClient({
      JavaScript: 1200,
      CSS: 300,
      HTML: 100,
    });

    const languages = await fetchRepositoryLanguages({
      octokit: clients.rest,
      repository: { owner: 'davidokothminyika-commits', name: 'profile-project' },
    });

    expect(languages).toEqual({ JavaScript: 1200, CSS: 300, HTML: 100 });
    expect(Object.isFrozen(languages)).toBe(true);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/davidokothminyika-commits/profile-project/languages',
    );
  });

  it('accepts an empty language map for a zero-language repository', async () => {
    const { clients } = createClient({});

    const languages = await fetchRepositoryLanguages({
      octokit: clients.rest,
      repository: { owner: 'davidokothminyika-commits', name: 'empty-project' },
    });

    expect(languages).toEqual({});
  });

  it('rejects negative, fractional and unsafe byte counts', async () => {
    for (const body of [
      { JavaScript: -1 },
      { JavaScript: 1.5 },
      { JavaScript: Number.MAX_VALUE },
    ]) {
      const { clients } = createClient(body);

      let caught;
      try {
        await fetchRepositoryLanguages({
          octokit: clients.rest,
          repository: { owner: 'davidokothminyika-commits', name: 'private-project' },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(GitHubResponseError);
      expect(caught.code).toBe('GITHUB_INVALID_LANGUAGE_RESPONSE');
      expect(caught.message).not.toContain('private-project');
    }
  });

  it('normalises 404 responses without leaking private repository identifiers', async () => {
    const privateName = 'private-project';
    const privateUrl = `https://api.github.com/repos/davidokothminyika-commits/${privateName}/languages`;

    let caught;
    try {
      await fetchRepositoryLanguages({
        octokit: failingClient(createApiFailure(404, { url: privateUrl })),
        repository: { owner: 'davidokothminyika-commits', name: privateName },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubApiError);
    expect(caught.code).toBe('GITHUB_NOT_FOUND');
    expect(caught.message).not.toContain(privateName);
    expect(JSON.stringify(caught)).not.toContain(privateName);
    expect(JSON.stringify(caught)).not.toContain(privateUrl);
  });

  it('classifies 403 permission failures separately from rate limits', async () => {
    const forbidden = createApiFailure(403, { url: 'https://api.github.com/repos/x/y/languages' });
    const rateLimited = createApiFailure(403, {
      url: 'https://api.github.com/repos/x/y/languages',
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '9999999999' },
    });

    await expect(
      fetchRepositoryLanguages({
        octokit: failingClient(forbidden),
        repository: { owner: 'x', name: 'y' },
      }),
    ).rejects.toMatchObject({ code: 'GITHUB_FORBIDDEN' });

    await expect(
      fetchRepositoryLanguages({
        octokit: failingClient(rateLimited),
        repository: { owner: 'x', name: 'y' },
      }),
    ).rejects.toMatchObject({ code: 'GITHUB_RATE_LIMITED' });
  });

  it('classifies authentication failures', async () => {
    await expect(
      fetchRepositoryLanguages({
        octokit: failingClient(createApiFailure(401)),
        repository: { owner: 'x', name: 'y' },
      }),
    ).rejects.toMatchObject({ code: 'GITHUB_AUTHENTICATION_FAILED' });
  });

  it('validates the repository argument', async () => {
    await expect(fetchRepositoryLanguages({})).rejects.toThrow(TypeError);
    await expect(
      fetchRepositoryLanguages({
        octokit: failingClient(createApiFailure(500)),
        repository: { owner: '', name: 'repo' },
      }),
    ).rejects.toThrow(TypeError);
  });
});
