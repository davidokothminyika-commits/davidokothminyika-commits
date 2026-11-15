import { fetchContributionCollection } from '../api/contributions.js';
import { DAY_MS } from '../utils/dates.js';
import { silentLogger } from '../utils/logger.js';
import { ContributionCollectionError } from './errors.js';

function assertSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('contribution collection settings are required');
  }
  if (
    !Number.isInteger(settings.windowDays) ||
    settings.windowDays < 1 ||
    settings.windowDays > 365
  ) {
    throw new RangeError('contributions.windowDays must be an integer between 1 and 365');
  }
  if (
    !Number.isInteger(settings.maxRepositories) ||
    settings.maxRepositories < 1 ||
    settings.maxRepositories > 100
  ) {
    throw new RangeError('contributions.maxRepositories must be an integer between 1 and 100');
  }
}

function repositoryMaps(repositories) {
  const publicByName = new Map();
  const privateByName = new Map();

  for (const repository of repositories) {
    if (
      !repository ||
      typeof repository.full_name !== 'string' ||
      typeof repository.private !== 'boolean'
    ) {
      throw new TypeError('repositories must contain validated repository records');
    }

    const key = repository.full_name.toLowerCase();
    if (repository.private) {
      privateByName.set(key, repository);
    } else {
      publicByName.set(key, repository);
    }
  }

  return { publicByName, privateByName };
}

/**
 * Collect the contribution calendar and classify per-repository commit totals.
 *
 * Private repository names and commit counts are never retained as a
 * per-repository breakdown. They are collapsed into an aggregate that may
 * contribute to overall statistics. If the per-repository breakdown does not
 * account for the total commit count, the breakdown is marked incomplete and
 * no partial split is exposed.
 */
export async function collectContributionStats({
  graphql,
  settings,
  repositories,
  now = new Date(),
  logger = silentLogger,
} = {}) {
  if (typeof graphql !== 'function') {
    throw new TypeError('graphql must be an authenticated GraphQL client function');
  }
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array of validated repository records');
  }
  assertSettings(settings);

  const toDate = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(toDate.getTime())) {
    throw new TypeError('now must be a valid date');
  }
  const fromDate = new Date(toDate.getTime() - settings.windowDays * DAY_MS);

  const collection = await fetchContributionCollection({
    graphql,
    from: fromDate,
    to: toDate,
    maxRepositories: settings.maxRepositories,
  });

  const { publicByName, privateByName } = repositoryMaps(repositories);
  const seen = new Set();
  const publicRepositories = [];

  let publicCommitContributions = 0;
  let privateCommitContributions = 0;
  let externalCommitContributions = 0;
  let breakdownTotal = 0;

  for (const entry of collection.commitContributionsByRepository) {
    const key = entry.repository.fullName.toLowerCase();
    if (seen.has(key)) {
      throw new ContributionCollectionError(
        'GitHub returned duplicate repository entries in the contribution breakdown. ' +
          'Collection cannot continue with contradictory data.',
        { code: 'CONTRIBUTION_BREAKDOWN_DUPLICATE' },
      );
    }
    seen.add(key);

    const knownPublic = publicByName.has(key);
    const knownPrivate = privateByName.has(key);

    if (entry.repository.isPrivate) {
      if (knownPublic) {
        throw new ContributionCollectionError(
          'GitHub returned conflicting visibility metadata for a repository with contributions. ' +
            'Collection cannot continue because private metadata may be misclassified.',
          { code: 'CONTRIBUTION_VISIBILITY_CONFLICT' },
        );
      }
      privateCommitContributions += entry.totalCount;
    } else if (knownPrivate) {
      throw new ContributionCollectionError(
        'GitHub returned conflicting visibility metadata for a repository with contributions. ' +
          'Collection cannot continue because private metadata may be misclassified.',
        { code: 'CONTRIBUTION_VISIBILITY_CONFLICT' },
      );
    } else if (knownPublic) {
      publicCommitContributions += entry.totalCount;
      publicRepositories.push({
        fullName: publicByName.get(key).full_name,
        totalCount: entry.totalCount,
      });
    } else {
      // Contributions to repositories outside the owned repository inventory
      // (for example organization repositories) are aggregated but never named.
      externalCommitContributions += entry.totalCount;
    }

    breakdownTotal += entry.totalCount;
  }

  if (breakdownTotal > collection.totals.commits) {
    throw new ContributionCollectionError(
      'GitHub reported more per-repository commits than total commits. ' +
        'Collection cannot continue with inconsistent data.',
      { code: 'CONTRIBUTION_BREAKDOWN_MISMATCH' },
    );
  }

  const breakdownComplete = breakdownTotal === collection.totals.commits;

  if (breakdownComplete) {
    publicRepositories.sort(
      (left, right) =>
        right.totalCount - left.totalCount || left.fullName.localeCompare(right.fullName),
    );
  }

  const result = Object.freeze({
    window: collection.window,
    totals: collection.totals,
    calendar: collection.calendar,
    contributionsByRepository: Object.freeze({
      complete: breakdownComplete,
      publicCommitContributions: breakdownComplete ? publicCommitContributions : null,
      privateCommitContributions: breakdownComplete ? privateCommitContributions : null,
      externalCommitContributions: breakdownComplete ? externalCommitContributions : null,
      publicRepositories: Object.freeze(breakdownComplete ? publicRepositories : []),
    }),
    coverage: Object.freeze({
      windowDays: settings.windowDays,
      maxRepositories: settings.maxRepositories,
      complete: true,
      breakdownComplete,
      privateContributionsReported: collection.totals.restrictedContributions > 0,
    }),
  });

  logger.info('Contribution collection completed.', {
    windowDays: settings.windowDays,
    calendarDays: result.window.dayCount,
    totalContributions: result.totals.contributions,
    totalCommits: result.totals.commits,
    breakdownComplete,
    privateContributionsReported: result.coverage.privateContributionsReported,
  });

  return result;
}
