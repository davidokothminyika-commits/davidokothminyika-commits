import { describe, expect, it } from 'vitest';

import { createPublicPayload } from '../../src/processors/index.js';
import { PrivacyViolationError } from '../../src/processors/errors.js';
import { createLogger } from '../../src/utils/logger.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

function publicStatistics() {
  return {
    repositories: { public: 1 },
    stars: 7,
    forks: 2,
    contributions: { total: 12, commits: 10 },
    languages: { totalBytes: 130, languageCount: 2 },
    activity: {
      items: [
        {
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-project',
          createdAt: '2026-11-14T00:00:00Z',
        },
      ],
      complete: true,
    },
  };
}

function publicLanguages() {
  return {
    totalBytes: 130,
    publicRepositoryCount: 1,
    languages: [{ name: 'JavaScript', bytes: 100 }],
  };
}

function featured() {
  return [
    {
      rank: 1,
      name: 'public-project',
      fullName: 'davidokothminyika-commits/public-project',
      stars: 4,
      forks: 1,
    },
  ];
}

describe('createPublicPayload', () => {
  it('assembles the final publishable payload from public views', () => {
    const payload = createPublicPayload({
      statistics: publicStatistics(),
      languages: publicLanguages(),
      featured: featured(),
      repositories: [createRepository()],
      logger: createLogger(),
    });

    expect(payload).toEqual({
      statistics: publicStatistics(),
      languages: publicLanguages(),
      featured: featured(),
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.featured)).toBe(true);
  });

  it('requires public statistics, language and featured inputs', () => {
    expect(() => createPublicPayload({ languages: publicLanguages(), featured: [] })).toThrow(
      TypeError,
    );
    expect(() => createPublicPayload({ statistics: publicStatistics(), featured: [] })).toThrow(
      TypeError,
    );
    expect(() =>
      createPublicPayload({ statistics: publicStatistics(), languages: publicLanguages() }),
    ).toThrow(TypeError);
    expect(() =>
      createPublicPayload({
        statistics: publicStatistics(),
        languages: publicLanguages(),
        featured: null,
      }),
    ).toThrow(TypeError);
  });

  it('fails closed when the assembled payload would leak a private identifier', () => {
    const privateRepository = createPrivateRepository({ id: 9001, name: 'secret-project' });
    const leakingFeatured = [
      {
        ...featured()[0],
        fullName: privateRepository.full_name,
        name: privateRepository.name,
        stars: 9001,
      },
    ];

    let caught;
    try {
      createPublicPayload({
        statistics: publicStatistics(),
        languages: publicLanguages(),
        featured: leakingFeatured,
        repositories: [createRepository(), privateRepository],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PrivacyViolationError);
  });
});
