import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/index.js', () => ({
  createGitHubClients: vi.fn(),
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock('../../src/collectors/index.js', () => ({
  collectRepositoryInventory: vi.fn(),
  collectLanguageStats: vi.fn(),
  collectContributionStats: vi.fn(),
  collectRecentActivity: vi.fn(),
}));

vi.mock('../../src/processors/index.js', () => ({
  aggregateLanguages: vi.fn(),
  aggregateStatistics: vi.fn(),
  createPublicLanguageSummary: vi.fn(),
  createPublicStatisticsSummary: vi.fn(),
  createPublicPayload: vi.fn(),
  rankPublicRepositories: vi.fn(),
}));

import { verifyAuthenticatedUser } from '../../src/api/index.js';
import {
  collectContributionStats,
  collectLanguageStats,
  collectRecentActivity,
  collectRepositoryInventory,
} from '../../src/collectors/index.js';
import {
  aggregateLanguages,
  aggregateStatistics,
  createPublicLanguageSummary,
  createPublicPayload,
  createPublicStatisticsSummary,
  rankPublicRepositories,
} from '../../src/processors/index.js';
import { runProfilePipeline } from '../../src/pipeline/index.js';
import { loadConfig } from '../../src/config/index.js';
import { silentLogger } from '../../src/utils/logger.js';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('runProfilePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the fail-closed collection to public payload flow', async () => {
    const config = loadConfig();
    const logger = silentLogger;
    const clients = { rest: { fakeRest: true }, graphql: { fakeGraphql: true } };
    const identity = { login: 'davidokothminyika-commits', type: 'User', publicRepositoryCount: 2 };

    const inventory = {
      coverage: { pagesFetched: 1, complete: true },
      repositories: [],
      allRepositories: [],
    };
    const languageStats = { collections: [], failures: [], coverage: { complete: true } };
    const aggregation = { languages: [] };
    const contributions = { total: 3, activeDays: 2, calendarDays: 365 };
    const activity = { items: [], complete: true };
    const statistics = {
      repositories: { public: 2 },
      stars: 1,
      forks: 0,
      contributions,
      activity,
    };
    const featured = [];
    const languageSummary = { languages: [], totalBytes: 10 };
    const statisticsSummary = {
      repositories: { public: 2 },
      stars: 1,
      forks: 0,
      contributions,
      activity,
    };
    const publicPayload = { statistics: statisticsSummary, languages: languageSummary, featured };

    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(identity);
    vi.mocked(collectRepositoryInventory).mockResolvedValue(inventory);
    vi.mocked(collectLanguageStats).mockResolvedValue(languageStats);
    vi.mocked(aggregateLanguages).mockReturnValue(aggregation);
    vi.mocked(collectContributionStats).mockResolvedValue(contributions);
    vi.mocked(collectRecentActivity).mockResolvedValue(activity);
    vi.mocked(aggregateStatistics).mockReturnValue(statistics);
    vi.mocked(rankPublicRepositories).mockReturnValue(featured);
    vi.mocked(createPublicLanguageSummary).mockReturnValue(languageSummary);
    vi.mocked(createPublicStatisticsSummary).mockReturnValue(statisticsSummary);
    vi.mocked(createPublicPayload).mockReturnValue(publicPayload);

    const result = await runProfilePipeline({ config, logger, clients, now: NOW });

    expect(verifyAuthenticatedUser).toHaveBeenCalledWith(clients, {
      expectedLogin: config.profile.github.username,
      logger,
    });
    expect(collectRepositoryInventory).toHaveBeenCalledWith({
      rest: clients.rest,
      collection: config.collection,
      identity,
      logger,
    });
    expect(collectLanguageStats).toHaveBeenCalledWith({
      rest: clients.rest,
      repositories: inventory.repositories,
      settings: config.collection.languages,
      logger,
    });
    expect(aggregateLanguages).toHaveBeenCalledWith({
      collections: languageStats.collections,
      failures: languageStats.failures,
      coverage: languageStats.coverage,
      logger,
    });
    expect(collectContributionStats).toHaveBeenCalledWith({
      graphql: clients.graphql,
      settings: config.collection.contributions,
      repositories: inventory.allRepositories,
      now: NOW,
      logger,
    });
    expect(collectRecentActivity).toHaveBeenCalledWith({
      rest: clients.rest,
      username: identity.login,
      repositories: inventory.allRepositories,
      settings: config.collection.recentActivity,
      now: NOW,
      logger,
    });
    expect(aggregateStatistics).toHaveBeenCalledWith({
      repositories: inventory.repositories,
      contributions,
      activity,
      identity,
      languages: aggregation,
      logger,
    });
    expect(rankPublicRepositories).toHaveBeenCalledWith({
      repositories: inventory.repositories,
      featured: config.profile.featured,
      allowForks: config.collection.featuredRepositories.allowForks,
      excludeNames: [config.profile.github.repository],
      logger,
    });
    expect(createPublicLanguageSummary).toHaveBeenCalledWith({
      aggregation,
      repositories: inventory.allRepositories,
      publish: config.collection.publish,
      logger,
    });
    expect(createPublicStatisticsSummary).toHaveBeenCalledWith({
      statistics,
      repositories: inventory.allRepositories,
      publish: config.collection.publish,
      logger,
    });
    expect(createPublicPayload).toHaveBeenCalledWith({
      statistics,
      languages: languageSummary,
      featured,
      repositories: inventory.allRepositories,
      logger,
    });

    expect(result.now).toBe(NOW);
    expect(result.publicPayload).toBe(publicPayload);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
