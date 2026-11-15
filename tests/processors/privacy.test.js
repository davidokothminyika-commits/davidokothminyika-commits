import { describe, expect, it } from 'vitest';

import {
  aggregateLanguages,
  assertNoPrivateRepositoryLeak,
  collectPrivateIdentifiers,
  createPublicLanguageSummary,
  createPublicStatisticsSummary,
  PrivacyViolationError,
} from '../../src/processors/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

function privacyFixture() {
  const publicRepository = createRepository({ id: 1, name: 'public-project' });
  const privateRepository = createPrivateRepository({
    id: 9001,
    name: 'secret-project',
    description: 'Confidential roadmap and internal notes',
    topics: ['internal-only', 'classified'],
  });

  const aggregation = aggregateLanguages({
    collections: [
      {
        repositoryId: publicRepository.id,
        private: false,
        languages: { JavaScript: 100, CSS: 25 },
      },
      {
        repositoryId: privateRepository.id,
        private: true,
        languages: { Python: 50, JavaScript: 25 },
      },
    ],
  });

  return { publicRepository, privateRepository, aggregation };
}

describe('collectPrivateIdentifiers', () => {
  it('only collects identifiers from private repositories', () => {
    const { publicRepository, privateRepository } = privacyFixture();

    const identifiers = collectPrivateIdentifiers([publicRepository, privateRepository]);

    expect(identifiers.names).toEqual(['secret-project']);
    expect(identifiers.fullNames).toEqual([privateRepository.full_name]);
    expect(identifiers.urls).toEqual([privateRepository.html_url]);
    expect(identifiers.descriptions).toEqual([privateRepository.description]);
    expect(identifiers.topics).toEqual(['internal-only', 'classified']);
    expect(identifiers.ids).toEqual(['9001']);
  });
});

describe('createPublicLanguageSummary', () => {
  it('publishes aggregate language data without private repository identifiers', () => {
    const { publicRepository, privateRepository, aggregation } = privacyFixture();

    const summary = createPublicLanguageSummary({
      aggregation,
      repositories: [publicRepository, privateRepository],
    });

    expect(summary).toMatchObject({
      totalBytes: 200,
      publicRepositoryCount: 1,
    });
    expect(summary).not.toHaveProperty('privateRepositoryCount');
    expect(summary.languages.map((language) => language.name)).toEqual([
      'JavaScript',
      'Python',
      'CSS',
    ]);

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain(privateRepository.html_url);
    expect(serialized).not.toContain('Confidential roadmap');
    expect(serialized).not.toContain('internal-only');
    expect(serialized).not.toContain('9001');
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.languages[0])).toBe(true);
  });

  it('publishes the private repository count only when explicitly configured', () => {
    const { aggregation } = privacyFixture();
    const { publicRepository, privateRepository } = privacyFixture();

    const summary = createPublicLanguageSummary({
      aggregation,
      repositories: [publicRepository, privateRepository],
      publish: { privateRepositoryCount: true },
    });

    expect(summary.privateRepositoryCount).toBe(1);
  });

  it('strips any extra fields from language entries', () => {
    const privateRepository = createPrivateRepository({ id: 9001, name: 'secret-project' });
    const aggregation = {
      totalBytes: 100,
      publicRepositoryCount: 0,
      privateRepositoryCount: 1,
      languages: [
        {
          name: 'Python',
          bytes: 100,
          percentage: 100,
          displayPercentage: 100,
          rank: 1,
          repositoryName: 'secret-project',
        },
      ],
    };

    const summary = createPublicLanguageSummary({
      aggregation,
      repositories: [privateRepository],
    });

    expect(summary.languages).toEqual([
      {
        name: 'Python',
        bytes: 100,
        percentage: 100,
        displayPercentage: 100,
        rank: 1,
      },
    ]);
    expect(JSON.stringify(summary)).not.toContain('secret-project');
  });

  it('does not log private repository identifiers', () => {
    const logs = [];
    const logger = createLogger({ level: 'debug', sink: (line) => logs.push(line) });
    const { publicRepository, privateRepository, aggregation } = privacyFixture();

    createPublicLanguageSummary({
      aggregation,
      repositories: [publicRepository, privateRepository],
      logger,
    });

    const serialized = logs.join('\n');
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain(privateRepository.html_url);
    expect(serialized).not.toContain('Confidential roadmap');
  });

  it('validates its arguments', () => {
    expect(() => createPublicLanguageSummary({})).toThrow(TypeError);
    expect(() =>
      createPublicLanguageSummary({ aggregation: { languages: [] }, repositories: null }),
    ).toThrow(TypeError);
  });
});

describe('assertNoPrivateRepositoryLeak', () => {
  it('rejects private names, URLs, descriptions, topics and identifiers', () => {
    const { publicRepository, privateRepository } = privacyFixture();
    const repositories = [publicRepository, privateRepository];
    const leakedValues = [
      { label: 'name', value: { name: 'secret-project' } },
      { label: 'full name', value: { repository: privateRepository.full_name } },
      { label: 'url', value: { url: privateRepository.html_url } },
      { label: 'description', value: { text: privateRepository.description } },
      { label: 'topic', value: { topics: ['internal-only'] } },
      { label: 'id', value: { id: privateRepository.id } },
      { label: 'id as text', value: { reference: '9001' } },
    ];

    for (const { label, value } of leakedValues) {
      let caught;
      try {
        assertNoPrivateRepositoryLeak(value, repositories);
      } catch (error) {
        caught = error;
      }

      expect(caught, `${label} should be rejected`).toBeInstanceOf(PrivacyViolationError);
      expect(String(caught.message)).not.toContain('secret-project');
      expect(JSON.stringify(caught)).not.toContain('secret-project');
    }
  });

  it('allows values that match a public language name', () => {
    const privateRepository = createPrivateRepository({ id: 9001, name: 'JavaScript' });

    expect(() =>
      assertNoPrivateRepositoryLeak(
        { languages: [{ name: 'JavaScript', bytes: 10 }] },
        [privateRepository],
        { allowedStrings: ['JavaScript'] },
      ),
    ).not.toThrow();
  });

  it('passes values that contain no private metadata', () => {
    const { publicRepository, privateRepository } = privacyFixture();

    expect(
      assertNoPrivateRepositoryLeak({ totalBytes: 100, languages: [{ name: 'JavaScript' }] }, [
        publicRepository,
        privateRepository,
      ]),
    ).toEqual({ totalBytes: 100, languages: [{ name: 'JavaScript' }] });
  });
});

describe('createPublicStatisticsSummary', () => {
  function createStatistics(overrides = {}) {
    return {
      repositories: { total: 2, public: 1, private: 1 },
      stars: 7,
      forks: 2,
      contributions: {
        total: 12,
        activeDays: 3,
        calendarDays: 366,
        activeDayPercentage: 0.82,
        currentStreak: 4,
        longestStreak: 9,
        commits: 10,
        issues: 1,
        pullRequests: 1,
        reviews: 0,
        repositories: 1,
        window: { fromDate: '2025-11-15', toDate: '2026-11-15' },
      },
      languages: { totalBytes: 130, languageCount: 2 },
      activity: {
        items: [
          {
            id: 'event-1',
            type: 'PushEvent',
            repository: 'davidokothminyika-commits/public-project',
            createdAt: '2026-11-14T00:00:00Z',
          },
        ],
        coverage: { complete: true },
      },
      ...overrides,
    };
  }

  it('publishes aggregate statistics without private splits or activity identifiers', () => {
    const { privateRepository } = privacyFixture();
    const summary = createPublicStatisticsSummary({
      statistics: createStatistics(),
      repositories: [createRepository(), privateRepository],
    });

    expect(summary).toMatchObject({
      stars: 7,
      forks: 2,
    });
    expect(summary).not.toHaveProperty('followers');
    expect(summary).not.toHaveProperty('following');
    expect(summary.repositories).toEqual({ public: 1 });
    expect(summary.contributions).toEqual({
      total: 12,
      activeDays: 3,
      calendarDays: 366,
      activeDayPercentage: 0.82,
      currentStreak: 4,
      longestStreak: 9,
      commits: 10,
      issues: 1,
      pullRequests: 1,
      reviews: 0,
      repositories: 1,
      window: { fromDate: '2025-11-15', toDate: '2026-11-15' },
    });
    expect(summary.contributions).not.toHaveProperty('restrictedContributions');
    expect(summary.languages).toEqual({ totalBytes: 130, languageCount: 2 });
    expect(summary.activity).toEqual({
      items: [
        {
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-project',
          createdAt: '2026-11-14T00:00:00Z',
        },
      ],
      complete: true,
    });
    expect(summary.activity.items[0]).not.toHaveProperty('id');

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain('Confidential roadmap');
    expect(serialized).not.toContain('internal-only');
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.activity.items[0])).toBe(true);
  });

  it('publishes private repository totals only when explicitly allowed', () => {
    const { privateRepository } = privacyFixture();
    const summary = createPublicStatisticsSummary({
      statistics: createStatistics({ repositories: { total: 2, public: 1, private: 1 } }),
      repositories: [createRepository(), privateRepository],
      publish: { privateRepositoryCount: true },
    });

    expect(summary.repositories).toEqual({ public: 1, private: 1, total: 2 });
  });

  it('accepts statistics without optional contribution, language or activity data', () => {
    const summary = createPublicStatisticsSummary({
      statistics: {
        repositories: { public: 0 },
        stars: 0,
        forks: 0,
      },
      repositories: [],
    });

    expect(summary.contributions).toBeNull();
    expect(summary.languages).toBeNull();
    expect(summary.activity).toBeNull();
  });

  it('rejects activity items without the minimum public fields', () => {
    expect(() =>
      createPublicStatisticsSummary({
        statistics: createStatistics({ activity: { items: [{ type: 'PushEvent' }] } }),
        repositories: [],
      }),
    ).toThrow(TypeError);
  });

  it('rejects statistics that lack a public repository count', () => {
    expect(() => createPublicStatisticsSummary({ statistics: {}, repositories: [] })).toThrow(
      TypeError,
    );
    expect(() =>
      createPublicStatisticsSummary({
        statistics: { repositories: { public: -1 } },
        repositories: [],
      }),
    ).toThrow(TypeError);
  });

  it('fails closed when activity exposes private repository identifiers', () => {
    const { privateRepository } = privacyFixture();

    let caught;
    try {
      createPublicStatisticsSummary({
        statistics: createStatistics({
          activity: {
            items: [
              {
                id: 'event-1',
                type: 'PushEvent',
                repository: privateRepository.full_name,
                createdAt: '2026-11-14T00:00:00Z',
              },
            ],
            coverage: { complete: true },
          },
        }),
        repositories: [createRepository(), privateRepository],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PrivacyViolationError);
  });
});
