import { addDays } from '../../src/utils/dates.js';

function weekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * Build a GraphQL contribution response for a date range. Daily counts come
 * from `counts`; every missing date is zero. Weeks are chunked in sevens, which
 * mirrors GitHub closely enough for schema and aggregate validation tests.
 */
export function buildContributionResponse({
  fromDate,
  toDate,
  counts = {},
  totalContributions = null,
  restrictedContributions = 0,
  totalCommitContributions = null,
  totalIssueContributions = 0,
  totalPullRequestContributions = 0,
  totalPullRequestReviewContributions = 0,
  totalRepositoryContributions = 0,
  repositories = [],
  startedAt = `${fromDate}T00:00:00Z`,
  endedAt = `${toDate}T23:59:59Z`,
} = {}) {
  const days = [];
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    days.push({
      date,
      contributionCount: counts[date] ?? 0,
      weekday: weekday(date),
    });
  }

  const calendarTotal = days.reduce((total, day) => total + day.contributionCount, 0);
  const total = totalContributions ?? calendarTotal;

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    const weekDays = days.slice(index, index + 7);
    weeks.push({ firstDay: weekDays[0].date, contributionDays: weekDays });
  }

  return {
    viewer: {
      contributionsCollection: {
        startedAt,
        endedAt,
        totalCommitContributions: totalCommitContributions ?? total,
        totalIssueContributions,
        totalPullRequestContributions,
        totalPullRequestReviewContributions,
        totalRepositoryContributions,
        restrictedContributionsCount: restrictedContributions,
        totalContributions: total,
        contributionCalendar: {
          totalContributions: total,
          weeks,
        },
        commitContributionsByRepository: repositories.map((repository) => ({
          repository: {
            nameWithOwner: repository.fullName,
            isPrivate: repository.private ?? false,
          },
          contributions: { totalCount: repository.totalCount },
        })),
      },
    },
  };
}

/**
 * GraphQL client mock that builds a response from the requested window, so
 * collectors can choose their own `from`/`to` without tests duplicating dates.
 */
export function createContributionGraphql({ counts = {}, repositories = [], ...overrides } = {}) {
  return async (query, variables) => {
    if (!query.includes('contributionsCollection')) {
      throw new Error('Unexpected GraphQL query in test');
    }
    return buildContributionResponse({
      fromDate: variables.from.slice(0, 10),
      toDate: variables.to.slice(0, 10),
      counts,
      repositories,
      ...overrides,
    });
  };
}

export function createPublicEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    type: overrides.type ?? 'PushEvent',
    repo: { name: overrides.repository ?? 'davidokothminyika-commits/profile-project' },
    created_at: overrides.created_at ?? '2026-11-14T10:00:00Z',
    payload: overrides.payload ?? { commits: [{ message: 'secret commit message' }] },
  };
}
