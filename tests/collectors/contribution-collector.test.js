import { describe, expect, it } from 'vitest';

import {
  collectContributionStats,
  ContributionCollectionError,
} from '../../src/collectors/index.js';
import { createContributionGraphql } from '../helpers/contribution-fixture.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const SETTINGS = { windowDays: 365, maxRepositories: 100 };

function repositories() {
  return [
    createRepository({ id: 1, name: 'public-one' }),
    createPrivateRepository({ id: 2, name: 'secret-project' }),
  ];
}

describe('collectContributionStats', () => {
  it('classifies public, private and external contributions without naming private repositories', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 10 },
      repositories: [
        { fullName: 'davidokothminyika-commits/public-one', totalCount: 5 },
        {
          fullName: 'davidokothminyika-commits/secret-project',
          private: true,
          totalCount: 3,
        },
        { fullName: 'some-org/external-project', totalCount: 2 },
      ],
    });

    const result = await collectContributionStats({
      graphql,
      settings: SETTINGS,
      repositories: repositories(),
      now: NOW,
    });

    expect(result.contributionsByRepository).toEqual({
      complete: true,
      publicCommitContributions: 5,
      privateCommitContributions: 3,
      externalCommitContributions: 2,
      publicRepositories: [{ fullName: 'davidokothminyika-commits/public-one', totalCount: 5 }],
    });
    expect(result.coverage).toMatchObject({
      windowDays: 365,
      maxRepositories: 100,
      complete: true,
      breakdownComplete: true,
      privateContributionsReported: false,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-project');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.contributionsByRepository.publicRepositories)).toBe(true);
  });

  it('hides every split when the per-repository breakdown is incomplete', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 12 },
      totalCommitContributions: 12,
      repositories: [{ fullName: 'davidokothminyika-commits/public-one', totalCount: 5 }],
    });

    const result = await collectContributionStats({
      graphql,
      settings: SETTINGS,
      repositories: repositories(),
      now: NOW,
    });

    expect(result.contributionsByRepository).toEqual({
      complete: false,
      publicCommitContributions: null,
      privateCommitContributions: null,
      externalCommitContributions: null,
      publicRepositories: [],
    });
    expect(result.coverage.breakdownComplete).toBe(false);
  });

  it('reports private contributions when GitHub supplies a restricted count', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 4 },
      restrictedContributions: 2,
      totalCommitContributions: 4,
      repositories: [],
    });

    const result = await collectContributionStats({
      graphql,
      settings: SETTINGS,
      repositories: repositories(),
      now: NOW,
    });

    expect(result.coverage.privateContributionsReported).toBe(true);
  });

  it('rejects duplicate repository entries', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 4 },
      totalCommitContributions: 4,
      repositories: [
        { fullName: 'davidokothminyika-commits/public-one', totalCount: 2 },
        { fullName: 'davidokothminyika-commits/public-one', totalCount: 2 },
      ],
    });

    await expect(
      collectContributionStats({
        graphql,
        settings: SETTINGS,
        repositories: repositories(),
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'CONTRIBUTION_BREAKDOWN_DUPLICATE' });
  });

  it('rejects conflicting visibility metadata', async () => {
    const graphql = createContributionGraphql({
      counts: { '2026-11-15': 2 },
      totalCommitContributions: 2,
      repositories: [{ fullName: 'davidokothminyika-commits/secret-project', totalCount: 2 }],
    });

    await expect(
      collectContributionStats({
        graphql,
        settings: SETTINGS,
        repositories: repositories(),
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ContributionCollectionError);
  });

  it('validates settings, repositories and graphql', async () => {
    await expect(collectContributionStats({})).rejects.toThrow(TypeError);
    await expect(
      collectContributionStats({
        graphql: async () => ({}),
        settings: { ...SETTINGS, windowDays: 0 },
        repositories: [],
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      collectContributionStats({
        graphql: async () => ({}),
        settings: { ...SETTINGS, maxRepositories: 0 },
        repositories: [],
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      collectContributionStats({
        graphql: createContributionGraphql({ counts: { '2026-11-15': 0 } }),
        settings: SETTINGS,
        repositories: [{ name: 'missing-fields' }],
        now: NOW,
      }),
    ).rejects.toThrow(TypeError);
  });
});
