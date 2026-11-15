import { describe, expect, it } from 'vitest';

import { ActivityCollectionError, collectRecentActivity } from '../../src/collectors/index.js';
import { createPublicEvent } from '../helpers/contribution-fixture.js';
import { createPagedRest } from '../helpers/fake-api.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const SETTINGS = { limit: 5, maxAgeDays: 90, maxPages: 3 };

function repositories() {
  return [
    createRepository({ id: 1, name: 'public-one' }),
    createRepository({ id: 2, name: 'public-two' }),
    createPrivateRepository({ id: 3, name: 'secret-project' }),
  ];
}

describe('collectRecentActivity', () => {
  it('keeps recent public events for known public repositories', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          id: 'event-1',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
        createPublicEvent({
          id: 'event-2',
          type: 'PullRequestEvent',
          repository: 'davidokothminyika-commits/public-two',
          created_at: '2026-11-13T09:00:00Z',
        }),
      ],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(result.items).toEqual([
      {
        id: 'event-1',
        type: 'PushEvent',
        repository: 'davidokothminyika-commits/public-one',
        createdAt: '2026-11-14T10:00:00.000Z',
      },
      {
        id: 'event-2',
        type: 'PullRequestEvent',
        repository: 'davidokothminyika-commits/public-two',
        createdAt: '2026-11-13T09:00:00.000Z',
      },
    ]);
    expect(result.coverage).toMatchObject({
      includedEventCount: 2,
      scannedEventCount: 2,
      complete: true,
      truncated: false,
    });
    expect(Object.isFrozen(result.items[0])).toBe(true);
  });

  it('skips unknown repositories, unsupported types and duplicate events', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          id: 'event-1',
          type: 'WatchEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
        createPublicEvent({
          id: 'event-2',
          type: 'ForkEvent',
          repository: 'someone-else/unknown',
        }),
        createPublicEvent({
          id: 'event-3',
          type: 'MemberEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
        createPublicEvent({
          id: 'event-1',
          type: 'WatchEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
        createPublicEvent({
          id: 'event-4',
          type: 'ReleaseEvent',
          repository: 'davidokothminyika-commits/public-two',
        }),
      ],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(result.items.map((item) => item.id)).toEqual(['event-1', 'event-4']);
    expect(result.coverage).toMatchObject({
      scannedEventCount: 5,
      includedEventCount: 2,
      skippedUnknownRepositoryCount: 1,
      skippedUnsupportedTypeCount: 1,
      duplicateEventCount: 1,
    });
  });

  it('never copies event payloads into activity output', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          payload: { commits: [{ message: 'confidential commit message' }] },
          repository: 'davidokothminyika-commits/public-one',
        }),
      ],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(JSON.stringify(result)).not.toContain('confidential commit message');
    expect(result.items[0]).not.toHaveProperty('payload');
  });

  it('aborts when the public feed references a known private repository', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          repository: 'davidokothminyika-commits/secret-project',
        }),
      ],
    ]);

    let caught;
    try {
      await collectRecentActivity({
        rest,
        username: 'davidokothminyika-commits',
        repositories: repositories(),
        settings: SETTINGS,
        now: NOW,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ActivityCollectionError);
    expect(caught.message).not.toContain('secret-project');
  });

  it('stops at the first event older than the configured age', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          id: 'recent',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
          created_at: '2026-11-10T00:00:00Z',
        }),
        createPublicEvent({
          id: 'old',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
          created_at: '2025-01-01T00:00:00Z',
        }),
        createPublicEvent({
          id: 'after-old',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
          created_at: '2026-11-11T00:00:00Z',
        }),
      ],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(result.items.map((item) => item.id)).toEqual(['recent']);
    expect(result.coverage.stoppedAtAge).toBe(true);
    expect(result.coverage.scannedEventCount).toBe(2);
  });

  it('caps the feed at the configured item limit', async () => {
    const { rest } = createPagedRest([
      [
        createPublicEvent({
          id: 'event-1',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
        createPublicEvent({
          id: 'event-2',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-two',
        }),
        createPublicEvent({
          id: 'event-3',
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/public-one',
        }),
      ],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: { ...SETTINGS, limit: 2 },
      now: NOW,
    });

    expect(result.items.map((item) => item.id)).toEqual(['event-1', 'event-2']);
  });

  it('marks a page-capped feed as incomplete', async () => {
    const { rest } = createPagedRest([
      [createPublicEvent({ id: 'event-1' })],
      [createPublicEvent({ id: 'event-2' })],
    ]);

    const result = await collectRecentActivity({
      rest,
      username: 'davidokothminyika-commits',
      repositories: repositories(),
      settings: { ...SETTINGS, maxPages: 1 },
      now: NOW,
    });

    expect(result.coverage).toMatchObject({ pagesFetched: 1, truncated: true, complete: false });
  });

  it('validates its arguments', async () => {
    const { rest } = createPagedRest([[]]);

    await expect(collectRecentActivity({})).rejects.toThrow(TypeError);
    await expect(
      collectRecentActivity({
        rest,
        username: '',
        repositories: [],
        settings: SETTINGS,
      }),
    ).rejects.toThrow(TypeError);
    await expect(
      collectRecentActivity({
        rest,
        username: 'user',
        repositories: [],
        settings: { ...SETTINGS, maxPages: 0 },
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      collectRecentActivity({
        rest,
        username: 'user',
        repositories: [{ name: 'incomplete' }],
        settings: SETTINGS,
      }),
    ).rejects.toThrow(TypeError);
  });
});
