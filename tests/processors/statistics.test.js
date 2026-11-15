import { describe, expect, it } from 'vitest';

import { aggregateStatistics } from '../../src/processors/index.js';
import { StatisticsError } from '../../src/processors/errors.js';
import { createLogger } from '../../src/utils/logger.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

describe('aggregateStatistics', () => {
  it('aggregates repository, contribution, language and activity totals', () => {
    const publicRepository = createRepository({ id: 1, name: 'public-one', stargazers_count: 4 });
    const privateRepository = createPrivateRepository({ id: 2, name: 'secret-project' });

    const statistics = aggregateStatistics({
      repositories: [publicRepository, privateRepository],
      contributions: {
        window: {
          from: '2026-11-15T00:00:00Z',
          to: '2026-11-16T00:00:00Z',
          fromDate: '2026-11-15',
          toDate: '2026-11-16',
          dayCount: 2,
        },
        totals: {
          contributions: 2,
          commits: 2,
          issues: 0,
          pullRequests: 0,
          reviews: 0,
          repositories: 1,
          restrictedContributions: 0,
        },
        calendar: {
          totalContributions: 2,
          days: [{ date: '2026-11-15', contributionCount: 2 }],
        },
      },
      activity: {
        items: [
          {
            id: 'event-1',
            type: 'PushEvent',
            repository: 'owner/repo',
            createdAt: '2026-11-15T00:00:00Z',
          },
        ],
        coverage: { complete: true },
      },
      identity: { followers: 3, following: 5 },
      languages: { totalBytes: 130, languages: [{ name: 'JavaScript', bytes: 100 }] },
      logger: createLogger(),
    });

    expect(statistics.repositories).toEqual({
      total: 2,
      public: 1,
      private: 1,
      forked: 0,
      archived: 0,
    });
    expect(statistics.stars).toBe(7);
    expect(statistics.forks).toBe(2);
    expect(statistics.followers).toBe(3);
    expect(statistics.following).toBe(5);
    expect(statistics.contributions).toMatchObject({
      total: 2,
      activeDays: 1,
      commits: 2,
      restrictedContributions: 0,
    });
    expect(statistics.languages).toEqual({ totalBytes: 130, languageCount: 1 });
    expect(statistics.activity).toEqual({
      items: [
        {
          id: 'event-1',
          type: 'PushEvent',
          repository: 'owner/repo',
          createdAt: '2026-11-15T00:00:00Z',
        },
      ],
      coverage: { complete: true },
    });
    expect(Object.isFrozen(statistics)).toBe(true);
  });

  it('returns null for optional contribution, language and activity inputs', () => {
    const statistics = aggregateStatistics({
      repositories: [createRepository({ id: 1, name: 'public-one' })],
      languages: null,
      activity: null,
      identity: null,
      logger: createLogger(),
    });

    expect(statistics.contributions).toBeNull();
    expect(statistics.languages).toBeNull();
    expect(statistics.activity).toBeNull();
    expect(statistics.followers).toBeNull();
  });

  it('refuses to aggregate over invalid repository records', () => {
    expect(() =>
      aggregateStatistics({ repositories: [{ id: 'one' }], logger: createLogger() }),
    ).toThrow(StatisticsError);
    expect(() =>
      aggregateStatistics({ repositories: [createRepository({ stargazers_count: -1 })] }),
    ).toThrow(StatisticsError);
  });
});
