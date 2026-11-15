import { describe, expect, it, vi } from 'vitest';

import {
  fetchContributionCollection,
  GitHubApiError,
  GitHubResponseError,
} from '../../src/api/index.js';
import {
  buildContributionResponse,
  createContributionGraphql,
} from '../helpers/contribution-fixture.js';
import { createApiFailure } from '../helpers/fake-api.js';

const FROM = new Date('2025-11-15T12:00:00Z');
const TO = new Date('2026-11-15T12:00:00Z');

describe('fetchContributionCollection', () => {
  it('returns a validated, frozen contribution collection', async () => {
    const graphql = createContributionGraphql({
      counts: { '2025-11-15': 2, '2025-11-16': 1, '2026-11-15': 3 },
      repositories: [{ fullName: 'davidokothminyika-commits/public-one', totalCount: 4 }],
    });

    const result = await fetchContributionCollection({ graphql, from: FROM, to: TO });

    expect(result.window).toMatchObject({
      fromDate: '2025-11-15',
      toDate: '2026-11-15',
      requestedDays: 366,
      dayCount: 366,
    });
    expect(result.totals).toMatchObject({
      contributions: 6,
      commits: 6,
      restrictedContributions: 0,
    });
    expect(result.calendar.totalContributions).toBe(6);
    expect(result.calendar.days[0]).toEqual({
      date: '2025-11-15',
      contributionCount: 2,
      weekday: 6,
    });
    expect(result.commitContributionsByRepository).toEqual([
      {
        repository: { fullName: 'davidokothminyika-commits/public-one', isPrivate: false },
        totalCount: 4,
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.calendar.days)).toBe(true);
    expect(Object.isFrozen(result.commitContributionsByRepository[0])).toBe(true);
  });

  it('does not request a field that does not exist on the collection type', async () => {
    const graphql = vi.fn(createContributionGraphql());

    await fetchContributionCollection({ graphql, from: FROM, to: TO });

    const query = graphql.mock.calls[0][0];
    expect(query).toContain('contributionCalendar');
    expect(query.match(/totalContributions/g)).toHaveLength(1);
    expect(query).toMatch(/contributionCalendar\s*{\s*totalContributions/);
    expect(query).not.toMatch(/restrictedContributionsCount\s*\n\s*totalContributions/);
    expect(query).not.toContain('totalRepositoryContributions\n      totalContributions');
  });

  it('rejects a response with an invalid or missing calendar total', async () => {
    const response = buildContributionResponse({ fromDate: '2025-11-15', toDate: '2026-11-15' });
    delete response.viewer.contributionsCollection.contributionCalendar.totalContributions;

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_CONTRIBUTION_RESPONSE' });
  });

  it('rejects a response with an invalid calendar total', async () => {
    const response = buildContributionResponse({ fromDate: '2025-11-15', toDate: '2026-11-15' });
    response.viewer.contributionsCollection.contributionCalendar.totalContributions = Number.NaN;

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_CONTRIBUTION_RESPONSE' });
  });

  it('sends the requested window and repository cap to GraphQL', async () => {
    const graphql = vi.fn(createContributionGraphql());

    await fetchContributionCollection({ graphql, from: FROM, to: TO, maxRepositories: 42 });

    expect(graphql).toHaveBeenCalledWith(expect.stringContaining('contributionsCollection'), {
      from: '2025-11-15T12:00:00.000Z',
      to: '2026-11-15T12:00:00.000Z',
      maxRepositories: 42,
    });
  });

  it('accepts a private breakdown entry without altering it', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 2 },
      repositories: [
        { fullName: 'davidokothminyika-commits/secret-project', private: true, totalCount: 2 },
      ],
    });

    const result = await fetchContributionCollection({ graphql, from: FROM, to: TO });

    expect(result.commitContributionsByRepository[0].repository.isPrivate).toBe(true);
  });

  it('rejects a window longer than one year', async () => {
    await expect(
      fetchContributionCollection({
        graphql: createContributionGraphql(),
        from: new Date('2025-01-01T00:00:00Z'),
        to: new Date('2026-01-02T00:00:00Z'),
      }),
    ).rejects.toThrow(/more than one year/);
  });

  it('rejects an empty or reversed window', async () => {
    await expect(
      fetchContributionCollection({ graphql: createContributionGraphql(), from: TO, to: FROM }),
    ).rejects.toThrow(/earlier than/);
    await expect(
      fetchContributionCollection({ graphql: createContributionGraphql(), from: TO, to: TO }),
    ).rejects.toThrow(/earlier than/);
  });

  it('validates its arguments', async () => {
    await expect(fetchContributionCollection({})).rejects.toThrow(TypeError);
    await expect(
      fetchContributionCollection({
        graphql: createContributionGraphql(),
        from: FROM,
        to: TO,
        maxRepositories: 0,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('normalises GraphQL failures without leaking API context', async () => {
    const graphql = async () => {
      throw createApiFailure(401, { url: 'https://api.github.com/graphql' });
    };

    let caught;
    try {
      await fetchContributionCollection({ graphql, from: FROM, to: TO });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubApiError);
    expect(caught.code).toBe('GITHUB_AUTHENTICATION_FAILED');
    expect(caught.message).not.toContain('api.github.com');
  });

  it('rejects a missing viewer or contribution collection', async () => {
    for (const response of [{ viewer: null }, { viewer: {} }, null]) {
      await expect(
        fetchContributionCollection({
          graphql: async () => response,
          from: FROM,
          to: TO,
        }),
      ).rejects.toBeInstanceOf(GitHubResponseError);
    }
  });

  it('rejects a calendar whose daily counts do not match its total', async () => {
    const response = buildContributionResponse({ fromDate: '2025-11-15', toDate: '2026-11-15' });
    response.viewer.contributionsCollection.contributionCalendar.totalContributions += 1;

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR' });
  });

  it('rejects duplicate calendar dates', async () => {
    const response = buildContributionResponse({ fromDate: '2025-11-15', toDate: '2026-11-15' });
    const days = response.viewer.contributionsCollection.contributionCalendar.weeks.flatMap(
      (week) => week.contributionDays,
    );
    response.viewer.contributionsCollection.contributionCalendar.weeks[0].contributionDays.push(
      days[0],
    );

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_CONTRIBUTION_RESPONSE' });
  });

  it('rejects an incomplete calendar', async () => {
    const response = buildContributionResponse({ fromDate: '2026-01-01', toDate: '2026-01-10' });

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INCOMPLETE_CONTRIBUTION_CALENDAR' });
  });

  it('rejects impossible totals and categories larger than the total', async () => {
    const response = buildContributionResponse({ fromDate: '2025-11-15', toDate: '2026-11-15' });
    response.viewer.contributionsCollection.restrictedContributionsCount = 999;

    await expect(
      fetchContributionCollection({ graphql: async () => response, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR' });

    const second = buildContributionResponse({
      fromDate: '2025-11-15',
      toDate: '2026-11-15',
    });
    second.viewer.contributionsCollection.totalIssueContributions = 999;

    await expect(
      fetchContributionCollection({ graphql: async () => second, from: FROM, to: TO }),
    ).rejects.toMatchObject({ code: 'GITHUB_INCONSISTENT_CONTRIBUTION_CALENDAR' });
  });
});
