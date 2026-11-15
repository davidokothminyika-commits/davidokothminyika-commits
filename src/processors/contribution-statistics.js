import { addDays, compareDateStrings, isValidDateString, toDateString } from '../utils/dates.js';
import { deepFreeze } from '../utils/freeze.js';
import { ContributionStatisticsError } from './errors.js';

function validateDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new ContributionStatisticsError(
      'Contribution data has no calendar days. Statistics cannot be calculated.',
    );
  }

  const seen = new Set();
  const validated = [];

  for (const day of days) {
    if (
      !day ||
      !isValidDateString(day.date) ||
      !Number.isInteger(day.contributionCount) ||
      day.contributionCount < 0
    ) {
      throw new ContributionStatisticsError(
        'Contribution data contains an invalid calendar day. Statistics cannot be calculated.',
      );
    }
    if (seen.has(day.date)) {
      throw new ContributionStatisticsError(
        'Contribution data contains duplicate calendar dates. Statistics cannot be calculated.',
      );
    }
    seen.add(day.date);
    validated.push({ date: day.date, contributionCount: day.contributionCount });
  }

  validated.sort((left, right) => compareDateStrings(left.date, right.date));
  return validated;
}

function referenceDateFrom(collection) {
  const iso = collection?.window?.to;
  if (typeof iso !== 'string') {
    throw new ContributionStatisticsError(
      'Contribution data is missing the collection window end. Statistics cannot be calculated.',
    );
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new ContributionStatisticsError(
      'Contribution data has an invalid window end. Statistics cannot be calculated.',
    );
  }
  return toDateString(date);
}

/**
 * Calculate active days and contribution streaks from a validated calendar.
 *
 * A current streak counts backwards from the window end. If today has no
 * contributions, the streak may still end yesterday so a day in progress does
 * not appear to break it. Longest streaks are limited to the collected window;
 * a streak that began before the window is therefore truncated by design.
 */
export function summarizeContributionDays({ days, referenceDate }) {
  const validatedDays = validateDays(days);
  if (!isValidDateString(referenceDate)) {
    throw new ContributionStatisticsError(
      'Contribution statistics require a valid reference date.',
    );
  }

  const counts = new Map(validatedDays.map((day) => [day.date, day.contributionCount]));
  const activeDays = validatedDays.filter((day) => day.contributionCount > 0).length;

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;

  for (const day of validatedDays) {
    if (day.contributionCount === 0) {
      runningStreak = 0;
      previousDate = day.date;
      continue;
    }

    runningStreak =
      previousDate !== null && addDays(previousDate, 1) === day.date ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = day.date;
  }

  const todayCount = counts.get(referenceDate) ?? 0;
  let cursor = todayCount > 0 ? referenceDate : addDays(referenceDate, -1);
  let currentStreak = 0;

  while ((counts.get(cursor) ?? 0) > 0) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return Object.freeze({
    totalContributions: validatedDays.reduce((total, day) => total + day.contributionCount, 0),
    activeDays,
    calendarDays: validatedDays.length,
    activeDayPercentage: validatedDays.length === 0 ? 0 : (activeDays / validatedDays.length) * 100,
    currentStreak,
    longestStreak,
  });
}

/**
 * Summarize a contribution collection produced by the contribution collector.
 * The returned object contains aggregate values only; no repository names from
 * any visibility class are copied.
 */
export function summarizeContributions({ collection } = {}) {
  if (!collection || !collection.calendar || !collection.window) {
    throw new ContributionStatisticsError(
      'A validated contribution collection is required to calculate statistics.',
    );
  }

  const summary = summarizeContributionDays({
    days: collection.calendar.days,
    referenceDate: referenceDateFrom(collection),
  });

  if (summary.totalContributions !== collection.calendar.totalContributions) {
    throw new ContributionStatisticsError(
      'Contribution calendar totals are inconsistent. Statistics cannot be calculated.',
    );
  }

  return deepFreeze({
    ...summary,
    window: {
      from: collection.window.from,
      to: collection.window.to,
      fromDate: collection.window.fromDate,
      toDate: collection.window.toDate,
      dayCount: collection.window.dayCount,
    },
    totals: {
      contributions: collection.totals?.contributions ?? summary.totalContributions,
      commits: collection.totals?.commits ?? 0,
      issues: collection.totals?.issues ?? 0,
      pullRequests: collection.totals?.pullRequests ?? 0,
      reviews: collection.totals?.reviews ?? 0,
      repositories: collection.totals?.repositories ?? 0,
      restrictedContributions: collection.totals?.restrictedContributions ?? 0,
    },
  });
}
