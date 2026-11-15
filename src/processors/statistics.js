import { silentLogger } from '../utils/logger.js';
import { deepFreeze } from '../utils/freeze.js';
import { summarizeContributions } from './contribution-statistics.js';
import { StatisticsError } from './errors.js';

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateRepository(repository) {
  if (
    !repository ||
    !Number.isInteger(repository.id) ||
    repository.id < 1 ||
    typeof repository.private !== 'boolean' ||
    typeof repository.fork !== 'boolean' ||
    typeof repository.archived !== 'boolean' ||
    !nonNegativeInteger(repository.stargazers_count) ||
    !nonNegativeInteger(repository.forks_count)
  ) {
    throw new StatisticsError(
      'Repository statistics input contains an invalid repository record. ' +
        'Statistics cannot be calculated.',
    );
  }
}

function validateLanguages(languages) {
  if (languages === null || languages === undefined) return null;
  if (
    typeof languages !== 'object' ||
    !nonNegativeInteger(languages.totalBytes) ||
    !Array.isArray(languages.languages)
  ) {
    throw new StatisticsError(
      'Language statistics input is invalid. Statistics cannot be calculated.',
    );
  }
  return {
    totalBytes: languages.totalBytes,
    languageCount: languages.languages.length,
  };
}

function validateActivity(activity) {
  if (activity === null || activity === undefined) return null;
  if (!activity || !Array.isArray(activity.items)) {
    throw new StatisticsError(
      'Activity statistics input is invalid. Statistics cannot be calculated.',
    );
  }
  return {
    items: activity.items,
    coverage: activity.coverage ?? null,
  };
}

function optionalCount(value) {
  return nonNegativeInteger(value) ? value : null;
}

/**
 * Aggregate repository, contribution, language and activity statistics.
 *
 * The result is an internal aggregate. It never contains repository names or
 * URLs, and it keeps public/private splits only as counts. The public summary
 * boundary decides which aggregate fields may be rendered.
 */
export function aggregateStatistics({
  repositories,
  contributions = null,
  activity = null,
  identity = null,
  languages = null,
  logger = silentLogger,
} = {}) {
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }
  for (const repository of repositories) {
    validateRepository(repository);
  }
  if (contributions !== null && contributions !== undefined) {
    if (!contributions.calendar || !contributions.window) {
      throw new StatisticsError(
        'Contribution statistics input is invalid. Statistics cannot be calculated.',
      );
    }
  }

  const contributionSummary =
    contributions === null || contributions === undefined
      ? null
      : summarizeContributions({ collection: contributions });
  const languageSummary = validateLanguages(languages);
  const activitySummary = validateActivity(activity);

  const publicRepositoryCount = repositories.filter((repository) => !repository.private).length;
  const privateRepositoryCount = repositories.length - publicRepositoryCount;
  const forkedRepositoryCount = repositories.filter((repository) => repository.fork).length;
  const archivedRepositoryCount = repositories.filter((repository) => repository.archived).length;

  const stars = repositories.reduce((total, repository) => total + repository.stargazers_count, 0);
  const forks = repositories.reduce((total, repository) => total + repository.forks_count, 0);

  const result = {
    repositories: {
      total: repositories.length,
      public: publicRepositoryCount,
      private: privateRepositoryCount,
      forked: forkedRepositoryCount,
      archived: archivedRepositoryCount,
    },
    stars,
    forks,
    followers: optionalCount(identity?.followers),
    following: optionalCount(identity?.following),
    contributions: contributionSummary
      ? {
          total: contributionSummary.totalContributions,
          activeDays: contributionSummary.activeDays,
          calendarDays: contributionSummary.calendarDays,
          activeDayPercentage: contributionSummary.activeDayPercentage,
          currentStreak: contributionSummary.currentStreak,
          longestStreak: contributionSummary.longestStreak,
          commits: contributionSummary.totals.commits,
          issues: contributionSummary.totals.issues,
          pullRequests: contributionSummary.totals.pullRequests,
          reviews: contributionSummary.totals.reviews,
          repositories: contributionSummary.totals.repositories,
          restrictedContributions: contributionSummary.totals.restrictedContributions,
          window: contributionSummary.window,
        }
      : null,
    languages: languageSummary,
    activity: activitySummary,
  };

  logger.info('Statistics aggregation completed.', {
    repositoryCount: result.repositories.total,
    starCount: result.stars,
    forkCount: result.forks,
    contributionCount: result.contributions?.total ?? null,
    activityCount: result.activity?.items.length ?? 0,
  });

  return deepFreeze(result);
}
