import { describe, expect, it } from 'vitest';

import { summarizeContributionDays, summarizeContributions } from '../../src/processors/index.js';
import { ContributionStatisticsError } from '../../src/processors/errors.js';

describe('summarizeContributionDays', () => {
  it('counts active days, total contributions and streaks', () => {
    const summary = summarizeContributionDays({
      days: [
        { date: '2026-11-13', contributionCount: 3 },
        { date: '2026-11-15', contributionCount: 2 },
        { date: '2026-11-14', contributionCount: 1 },
      ],
      referenceDate: '2026-11-15',
    });

    expect(summary).toEqual({
      totalContributions: 6,
      activeDays: 3,
      calendarDays: 3,
      activeDayPercentage: 100,
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it('counts the current streak from the most recent active day back', () => {
    const summary = summarizeContributionDays({
      days: [
        { date: '2026-11-13', contributionCount: 1 },
        { date: '2026-11-14', contributionCount: 2 },
        { date: '2026-11-15', contributionCount: 1 },
      ],
      referenceDate: '2026-11-16',
    });

    expect(summary.currentStreak).toBe(3);
    expect(summary.totalContributions).toBe(4);
    expect(summary.activeDayPercentage).toBe(100);
  });

  it('treats today without contributions as an unfinished streak', () => {
    const summary = summarizeContributionDays({
      days: [
        { date: '2026-11-14', contributionCount: 2 },
        { date: '2026-11-15', contributionCount: 0 },
      ],
      referenceDate: '2026-11-15',
    });

    expect(summary.currentStreak).toBe(1);
  });

  it('reports an idle current streak and truncated longest streak', () => {
    const summary = summarizeContributionDays({
      days: [{ date: '2026-11-15', contributionCount: 0 }],
      referenceDate: '2026-11-16',
    });

    expect(summary).toEqual({
      totalContributions: 0,
      activeDays: 0,
      calendarDays: 1,
      activeDayPercentage: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('validates its input and reference date', () => {
    expect(() => summarizeContributionDays({ days: [], referenceDate: '2026-11-16' })).toThrow(
      ContributionStatisticsError,
    );
    expect(() =>
      summarizeContributionDays({
        days: [{ date: '2026-02-30', contributionCount: 1 }],
        referenceDate: '2026-11-16',
      }),
    ).toThrow(ContributionStatisticsError);
    expect(() =>
      summarizeContributionDays({ days: [{ date: '2026-11-15', contributionCount: 1 }] }),
    ).toThrow(ContributionStatisticsError);
    expect(() =>
      summarizeContributionDays({
        days: [{ date: '2026-11-15', contributionCount: 1 }],
        referenceDate: 5,
      }),
    ).toThrow(ContributionStatisticsError);
  });
});

describe('summarizeContributions', () => {
  it('summarizes an aggregate contribution collection without repository splits', () => {
    const collection = {
      window: {
        from: '2025-11-16T12:00:00.000Z',
        to: '2026-11-15T12:00:00.000Z',
        fromDate: '2025-11-15',
        toDate: '2026-11-15',
        dayCount: 366,
      },
      totals: {
        contributions: 12,
        commits: 10,
        issues: 1,
        pullRequests: 1,
        reviews: 0,
        repositories: 2,
        restrictedContributions: 1,
      },
      calendar: {
        totalContributions: 5,
        days: [
          { date: '2026-11-15', contributionCount: 3 },
          { date: '2026-11-14', contributionCount: 2 },
        ],
      },
    };

    const summary = summarizeContributions({ collection });

    expect(summary.totalContributions).toBe(5);
    expect(summary.totals.commits).toBe(10);
    expect(summary.totals.restrictedContributions).toBe(1);
    expect(summary.window).toMatchObject({ fromDate: '2025-11-15', toDate: '2026-11-15' });
  });

  it('rejects a calendar that disagrees with the collection total', () => {
    const collection = {
      window: { to: '2026-11-15T00:00:00Z', from: '2025-11-15T00:00:00Z' },
      calendar: {
        totalContributions: 5,
        days: [{ date: '2026-11-15', contributionCount: 2 }],
      },
    };

    expect(() => summarizeContributions({ collection })).toThrow(ContributionStatisticsError);
  });

  it('requires a validated collection', () => {
    expect(() => summarizeContributions({ collection: null })).toThrow(ContributionStatisticsError);
  });

  it('does not leak private repository metadata through statistics summaries', () => {
    const summary = summarizeContributions({
      collection: {
        window: { from: '2026-11-15T00:00:00Z', to: '2026-11-16T00:00:00Z', dayCount: 2 },
        totals: { contributions: 2, commits: 2, restrictedContributions: 0 },
        calendar: {
          totalContributions: 2,
          days: [{ date: '2026-11-15', contributionCount: 2 }],
        },
      },
    });

    expect(summary.totalContributions).toBe(2);
    expect(JSON.stringify(summary)).not.toContain('secret-project');
  });
});
