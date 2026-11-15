import { describe, expect, it } from 'vitest';

import { rankPublicRepositories, RepositorySelectionError } from '../../src/processors/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

const FEATURED = {
  mode: 'automatic',
  repositories: [],
  exclude: ['davidokothminyika-commits'],
  limit: 4,
};

describe('rankPublicRepositories', () => {
  it('ranks public repositories deterministically by stars, forks, push date and name', () => {
    const alpha = createRepository({
      id: 1,
      name: 'alpha',
      stargazers_count: 5,
      forks_count: 2,
      pushed_at: '2025-01-01T00:00:00Z',
    });
    const beta = createRepository({
      id: 2,
      name: 'beta',
      stargazers_count: 5,
      forks_count: 9,
      pushed_at: '2025-06-01T00:00:00Z',
    });
    const gamma = createRepository({
      id: 3,
      name: 'gamma',
      stargazers_count: 9,
      forks_count: 0,
      pushed_at: '2024-01-01T00:00:00Z',
    });

    const ranked = rankPublicRepositories({
      repositories: [alpha, beta, gamma],
      featured: FEATURED,
      limit: 2,
      logger: createLogger(),
    });

    expect(ranked.map((repository) => repository.fullName)).toEqual([
      'davidokothminyika-commits/gamma',
      'davidokothminyika-commits/beta',
    ]);
    expect(ranked[0]).toMatchObject({ rank: 1, stars: 9, forks: 0 });
    expect(ranked.map((repository) => repository.name)).toEqual(['gamma', 'beta']);
  });

  it('breaks ties by most recent push and then by name', () => {
    const alpha = createRepository({
      id: 1,
      name: 'alpha',
      stargazers_count: 3,
      forks_count: 1,
      pushed_at: '2024-02-01T00:00:00Z',
    });
    const beta = createRepository({
      id: 2,
      name: 'beta',
      stargazers_count: 3,
      forks_count: 1,
      pushed_at: '2025-02-01T00:00:00Z',
    });
    const delta = createRepository({
      id: 3,
      name: 'delta',
      stargazers_count: 3,
      forks_count: 1,
      pushed_at: '2025-02-01T00:00:00Z',
    });

    const ranked = rankPublicRepositories({
      repositories: [alpha, beta, delta],
      featured: { ...FEATURED, exclude: [] },
      logger: createLogger(),
    });

    expect(ranked.map((repository) => repository.name)).toEqual(['beta', 'delta', 'alpha']);
  });

  it('excludes private, archived and fork repositories by default', () => {
    const privateRepository = createPrivateRepository({ id: 9, name: 'secret-project' });
    const archived = createRepository({ id: 8, name: 'archived-project', archived: true });
    const fork = createRepository({ id: 7, name: 'fork-project', fork: true });
    const publicRepo = createRepository({ id: 6, name: 'public-project' });

    const ranked = rankPublicRepositories({
      repositories: [privateRepository, archived, fork, publicRepo],
      featured: FEATURED,
      logger: createLogger(),
    });

    expect(ranked.map((repository) => repository.name)).toEqual(['public-project']);
    expect(ranked[0].private).toBeUndefined();
    expect(ranked[0]).not.toHaveProperty('private');
  });

  it('allows forks when configured', () => {
    const fork = createRepository({ id: 7, name: 'fork-project', fork: true });

    const ranked = rankPublicRepositories({
      repositories: [fork],
      featured: FEATURED,
      allowForks: true,
      logger: createLogger(),
    });

    expect(ranked).toHaveLength(1);
  });

  it('restores curated selection to the configured repository names', () => {
    const one = createRepository({ id: 1, name: 'project-one' });
    const two = createRepository({ id: 2, name: 'project-two' });
    const three = createRepository({ id: 3, name: 'project-three' });

    const ranked = rankPublicRepositories({
      repositories: [one, two, three],
      featured: { mode: 'curated', repositories: ['project-three', 'project-one'], limit: 2 },
      logger: createLogger(),
    });

    expect(ranked.map((repository) => repository.fullName)).toEqual([
      'davidokothminyika-commits/project-one',
      'davidokothminyika-commits/project-three',
    ]);
    expect(ranked.map((repository) => repository.name)).toEqual(['project-one', 'project-three']);
  });

  it('validates ranking inputs', () => {
    expect(() =>
      rankPublicRepositories({
        repositories: [createRepository()],
        featured: { ...FEATURED, limit: 0 },
      }),
    ).toThrow(RepositorySelectionError);
    expect(() =>
      rankPublicRepositories({
        repositories: [createRepository()],
        featured: { mode: 'sometimes', repositories: [] },
      }),
    ).toThrow(RepositorySelectionError);
    expect(() =>
      rankPublicRepositories({ repositories: [createRepository()], featured: { mode: 'curated' } }),
    ).toThrow(RepositorySelectionError);
  });
});
