import { contributionsResponseSchema } from '../schemas/contributions.schema.js';
import { addDays, countDaysInclusive, toDateString } from '../utils/dates.js';
import { GitHubResponseError, normalizeApiError } from './errors.js';

const CONTRIBUTION_OPERATION = 'contribution collection';

const CONTRIBUTIONS_QUERY = `query ProfileContributions($from: DateTime!, $to: DateTime!, $maxRepositories: Int!) {
  viewer {
    contributionsCollection(from: $from, to: $to) {
      startedAt
      endedAt
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays {
            date
            contributionCount
            weekday
          }
        }
      }
      commitContributionsByRepository(maxRepositories: $maxRepositories) {
        repository {
          nameWithOwner
          isPrivate
        }
        contributions {
          totalCount
        }
      }
    }
  }
}`;

function toInstant(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid date`);
  }
  return date;
}

function responseError(code, message) {
  return new GitHubResponseError({
    operation: CONTRIBUTION_OPERATION,
    code,
    message,
  });
}

/**
 * Fetch and validate the authenticated user's contribution calendar.
 *
 * GitHub limits a contributions collection to one year. The query returns
 * aggregate categories plus `commitContributionsByRepository`, which is used
 * internally to separate public and private commit totals. Private repository
 * names are retained only long enough for the collector to classify them and
 * must never be copied into output.
 */
export async function fetchContributionCollection({
  graphql,
  from,
  to,
  maxRepositories = 100,
} = {}) {
  if (typeof graphql !== 'function') {
    throw new TypeError('graphql must be an authenticated GraphQL client function');
  }
  if (!Number.isInteger(maxRepositories) || maxRepositories < 1 || maxRepositories > 100) {
    throw new RangeError('maxRepositories must be an integer between 1 and 100');
  }

  const fromInstant = toInstant(from, 'from');
  const toInstantValue = toInstant(to, 'to');
  if (fromInstant.getTime() >= toInstantValue.getTime()) {
    throw new RangeError('from must be earlier than to');
  }

  const fromDate = toDateString(fromInstant);
  const toDate = toDateString(toInstantValue);
  const requestedDays = countDaysInclusive(fromDate, toDate);
  if (requestedDays > 366) {
    throw new RangeError('Contribution collection cannot span more than one year');
  }

  let data;
  try {
    data = await graphql(CONTRIBUTIONS_QUERY, {
      from: fromInstant.toISOString(),
      to: toInstantValue.toISOString(),
      maxRepositories,
    });
  } catch (error) {
    throw normalizeApiError(error, { operation: CONTRIBUTION_OPERATION });
  }

  const parsed = contributionsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw responseError(
      'GITHUB_INVALID_CONTRIBUTION_RESPONSE',
      'GitHub returned an invalid contribution collection during contribution collection. ' +
        'Collection cannot continue with unvalidated data.',
    );
  }

  const collection = parsed.data.viewer?.contributionsCollection;
  if (!collection) {
    throw responseError(
      'GITHUB_CONTRIBUTIONS_UNAVAILABLE',
      'GitHub returned no contribution collection for the authenticated account. ' +
        'Collection cannot continue because contribution statistics would be incomplete.',
    );
  }

  const days = [];
  const seenDates = new Set();
  for (const week of collection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      if (seenDates.has(day.date)) {
        throw responseError(
          'GITHUB_INVALID_CONTRIBUTION_RESPONSE',
          'GitHub returned duplicate calendar dates during contribution collection. ' +
            'Collection cannot continue with contradictory data.',
        );
      }
      seenDates.add(day.date);
      days.push({ ...day });
    }
  }
  days.sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));

  const calendarTotal = days.reduce((total, day) => total + day.contributionCount, 0);
  if (calendarTotal !== collection.contributionCalendar.totalContributions) {
    throw responseError(
      'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR',
      'GitHub returned a contribution calendar whose daily counts do not match its total. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  if (
    collection.restrictedContributionsCount > collection.contributionCalendar.totalContributions
  ) {
    throw responseError(
      'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR',
      'GitHub reported more restricted contributions than total contributions. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  const categoryTotals = [
    collection.totalCommitContributions,
    collection.totalIssueContributions,
    collection.totalPullRequestContributions,
    collection.totalPullRequestReviewContributions,
    collection.totalRepositoryContributions,
  ];
  if (categoryTotals.some((value) => value > collection.contributionCalendar.totalContributions)) {
    throw responseError(
      'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR',
      'GitHub reported a contribution category larger than the total. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  const breakdownTotal = collection.commitContributionsByRepository.reduce(
    (total, entry) => total + entry.contributions.totalCount,
    0,
  );
  if (breakdownTotal > collection.totalCommitContributions) {
    throw responseError(
      'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR',
      'GitHub reported more per-repository commits than total commits. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  const firstDay = days[0]?.date;
  const lastDay = days[days.length - 1]?.date;
  if (!firstDay || !lastDay) {
    throw responseError(
      'GITHUB_INVALID_CONTRIBUTION_RESPONSE',
      'GitHub returned an empty contribution calendar during contribution collection. ' +
        'Collection cannot continue because contribution statistics would be incomplete.',
    );
  }

  // GitHub rounds collection boundaries to calendar days. Allow a small margin
  // for the returned calendar rather than assuming an exact day count.
  const minimumDays = Math.max(1, requestedDays - 2);
  const maximumDays = requestedDays + 1;
  if (days.length < minimumDays || days.length > maximumDays) {
    throw responseError(
      'GITHUB_INCOMPLETE_CONTRIBUTION_CALENDAR',
      'GitHub returned a contribution calendar with an unexpected number of days. ' +
        'Collection cannot continue because contribution statistics may be incomplete.',
    );
  }

  if (firstDay < addDays(fromDate, -1) || lastDay > addDays(toDate, 1)) {
    throw responseError(
      'GITHUB_INVALID_CONTRIBUTION_RESPONSE',
      'GitHub returned contribution days outside the requested window. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  if (new Date(collection.startedAt).getTime() > new Date(collection.endedAt).getTime()) {
    throw responseError(
      'GITHUB_INVALID_CONTRIBUTION_RESPONSE',
      'GitHub returned a contribution window that ends before it starts. ' +
        'Collection cannot continue with inconsistent data.',
    );
  }

  const commitContributionsByRepository = collection.commitContributionsByRepository.map(
    (entry) => ({
      repository: {
        fullName: entry.repository.nameWithOwner,
        isPrivate: entry.repository.isPrivate,
      },
      totalCount: entry.contributions.totalCount,
    }),
  );

  return Object.freeze({
    window: Object.freeze({
      from: fromInstant.toISOString(),
      to: toInstantValue.toISOString(),
      fromDate,
      toDate,
      requestedDays,
      dayCount: days.length,
      startedAt: collection.startedAt,
      endedAt: collection.endedAt,
    }),
    totals: Object.freeze({
      contributions: collection.contributionCalendar.totalContributions,
      commits: collection.totalCommitContributions,
      issues: collection.totalIssueContributions,
      pullRequests: collection.totalPullRequestContributions,
      reviews: collection.totalPullRequestReviewContributions,
      repositories: collection.totalRepositoryContributions,
      restrictedContributions: collection.restrictedContributionsCount,
    }),
    calendar: Object.freeze({
      totalContributions: collection.contributionCalendar.totalContributions,
      days: Object.freeze(days.map((day) => Object.freeze({ ...day }))),
    }),
    commitContributionsByRepository: Object.freeze(
      commitContributionsByRepository.map((entry) =>
        Object.freeze({
          repository: Object.freeze({ ...entry.repository }),
          totalCount: entry.totalCount,
        }),
      ),
    ),
  });
}
