import { verifyAuthenticatedUser } from '../api/index.js';
import {
  collectContributionStats,
  collectLanguageStats,
  collectRecentActivity,
  collectRepositoryInventory,
} from '../collectors/index.js';
import {
  aggregateLanguages,
  aggregateStatistics,
  createPublicLanguageSummary,
  createPublicPayload,
  createPublicStatisticsSummary,
  rankPublicRepositories,
} from '../processors/index.js';
import { deepFreeze } from '../utils/freeze.js';

/**
 * Run the complete profile collection and public-data assembly pipeline.
 *
 * The orchestration is shared by the local collection command and the publish
 * command so both always consume identical, fail-closed data. The returned
 * value is deeply frozen and contains public-safe aggregates plus the
 * discovered inventory used for validation; raw API payloads never cross this
 * boundary.
 */
export async function runProfilePipeline({ config, logger, clients, now = new Date() } = {}) {
  const identity = await verifyAuthenticatedUser(clients, {
    expectedLogin: config.profile.github.username,
    logger,
  });

  const inventory = await collectRepositoryInventory({
    rest: clients.rest,
    collection: config.collection,
    identity,
    logger,
  });

  const languageStats = await collectLanguageStats({
    rest: clients.rest,
    repositories: inventory.repositories,
    settings: config.collection.languages,
    logger,
  });

  const aggregation = aggregateLanguages({
    collections: languageStats.collections,
    failures: languageStats.failures,
    coverage: languageStats.coverage,
    logger,
  });

  const contributions = await collectContributionStats({
    graphql: clients.graphql,
    settings: config.collection.contributions,
    repositories: inventory.allRepositories,
    now,
    logger,
  });

  const activity = await collectRecentActivity({
    rest: clients.rest,
    username: identity.login,
    repositories: inventory.allRepositories,
    settings: config.collection.recentActivity,
    now,
    logger,
  });

  const statistics = aggregateStatistics({
    repositories: inventory.repositories,
    contributions,
    activity,
    identity,
    languages: aggregation,
    logger,
  });

  const featured = rankPublicRepositories({
    repositories: inventory.repositories,
    featured: config.profile.featured,
    allowForks: config.collection.featuredRepositories.allowForks,
    excludeNames: [config.profile.github.repository],
    logger,
  });

  const languageSummary = createPublicLanguageSummary({
    aggregation,
    repositories: inventory.allRepositories,
    publish: config.collection.publish,
    logger,
  });

  const statisticsSummary = createPublicStatisticsSummary({
    statistics,
    repositories: inventory.allRepositories,
    publish: config.collection.publish,
    logger,
  });

  const publicPayload = createPublicPayload({
    statistics,
    languages: languageSummary,
    featured,
    repositories: inventory.allRepositories,
    logger,
  });

  return deepFreeze({
    now,
    identity,
    inventory,
    aggregation,
    contributions,
    activity,
    statistics,
    featured,
    languageSummary,
    statisticsSummary,
    publicPayload,
  });
}
