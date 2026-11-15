import { describe, expect, it } from 'vitest';

import { listPublicEvents, UnexpectedPageError } from '../../src/api/index.js';
import { createPublicEvent } from '../helpers/contribution-fixture.js';
import { createPagedRest } from '../helpers/fake-api.js';

describe('listPublicEvents', () => {
  it('returns validated public events and never retains payloads', async () => {
    const { rest, iteratorCalls } = createPagedRest([
      [
        createPublicEvent({ id: 'event-1', type: 'PushEvent' }),
        createPublicEvent({
          id: 'event-2',
          type: 'IssuesEvent',
          repository: 'davidokothminyika-commits/another-project',
        }),
      ],
    ]);

    const result = await listPublicEvents({
      octokit: rest,
      username: 'davidokothminyika-commits',
      maxPages: 1,
    });

    expect(result.events).toEqual([
      {
        id: 'event-1',
        type: 'PushEvent',
        repo: { name: 'davidokothminyika-commits/profile-project' },
        created_at: '2026-11-14T10:00:00Z',
      },
      {
        id: 'event-2',
        type: 'IssuesEvent',
        repo: { name: 'davidokothminyika-commits/another-project' },
        created_at: '2026-11-14T10:00:00Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('secret commit message');
    expect(iteratorCalls[0]).toMatchObject({
      route: 'GET /users/{username}/events/public',
      parameters: { username: 'davidokothminyika-commits', per_page: 100 },
    });
    expect(Object.isFrozen(result.events[0])).toBe(true);
  });

  it('reports truncation when the page cap hides newer pages', async () => {
    const { rest } = createPagedRest([
      [createPublicEvent({ id: 'event-1' })],
      [createPublicEvent({ id: 'event-2' })],
    ]);

    const result = await listPublicEvents({
      octokit: rest,
      username: 'davidokothminyika-commits',
      maxPages: 1,
    });

    expect(result.pages).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.events.map((event) => event.id)).toEqual(['event-1']);
  });

  it('reports a complete feed when the final page has no next link', async () => {
    const { rest } = createPagedRest([[createPublicEvent({ id: 'event-1' })]]);

    const result = await listPublicEvents({
      octokit: rest,
      username: 'davidokothminyika-commits',
      maxPages: 3,
    });

    expect(result.truncated).toBe(false);
    expect(result.pages).toBe(1);
  });

  it('rejects invalid event payloads', async () => {
    const { rest } = createPagedRest([[{ id: 'event-1', type: 'PushEvent' }]]);

    await expect(
      listPublicEvents({ octokit: rest, username: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_INVALID_EVENT_RESPONSE' });
  });

  it('rejects non-array pages', async () => {
    const { rest } = createPagedRest([{ data: [] }]);
    rest.paginate.iterator = () => ({
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ value: { data: 'not-an-array' }, done: false }),
        };
      },
    });

    await expect(
      listPublicEvents({ octokit: rest, username: 'davidokothminyika-commits' }),
    ).rejects.toBeInstanceOf(UnexpectedPageError);
  });

  it('normalises iterator failures', async () => {
    const { rest } = createPagedRest([], { throwOnIterator: new Error('socket closed') });

    await expect(
      listPublicEvents({ octokit: rest, username: 'davidokothminyika-commits' }),
    ).rejects.toMatchObject({ code: 'GITHUB_NETWORK_ERROR' });
  });

  it('validates its arguments', async () => {
    const { rest } = createPagedRest([[]]);

    await expect(listPublicEvents({ octokit: rest, username: '' })).rejects.toThrow(TypeError);
    await expect(listPublicEvents({ octokit: rest, username: 'user', perPage: 0 })).rejects.toThrow(
      RangeError,
    );
    await expect(
      listPublicEvents({ octokit: rest, username: 'user', maxPages: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(listPublicEvents({ username: 'user' })).rejects.toThrow(TypeError);
  });
});
