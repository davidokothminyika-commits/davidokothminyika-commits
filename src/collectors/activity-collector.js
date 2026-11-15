import { listPublicEvents } from '../api/activity.js';
import { DAY_MS } from '../utils/dates.js';
import { silentLogger } from '../utils/logger.js';
import { ActivityCollectionError } from './errors.js';

const SUPPORTED_EVENT_TYPES = new Set([
  'CommitCommentEvent',
  'CreateEvent',
  'ForkEvent',
  'IssueCommentEvent',
  'IssuesEvent',
  'PublicEvent',
  'PullRequestEvent',
  'PullRequestReviewEvent',
  'PushEvent',
  'ReleaseEvent',
  'WatchEvent',
]);

function assertSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('recent activity settings are required');
  }
  if (!Number.isInteger(settings.limit) || settings.limit < 1 || settings.limit > 20) {
    throw new RangeError('recentActivity.limit must be an integer between 1 and 20');
  }
  if (
    !Number.isInteger(settings.maxAgeDays) ||
    settings.maxAgeDays < 1 ||
    settings.maxAgeDays > 365
  ) {
    throw new RangeError('recentActivity.maxAgeDays must be an integer between 1 and 365');
  }
  if (!Number.isInteger(settings.maxPages) || settings.maxPages < 1 || settings.maxPages > 20) {
    throw new RangeError('recentActivity.maxPages must be an integer between 1 and 20');
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
 * Collect a recent public activity feed for the profile account.
 *
 * Only the public events endpoint is used. Every event is also cross-checked
 * against the discovered repository inventory: an event for a known private
 * repository aborts collection, and events for repositories outside the owned
 * inventory are ignored. Payload data is never retained, so commit messages and
 * issue text cannot reach rendered output.
 *
 * The feed is deliberately bounded. `coverage.complete` is false when the page
 * cap may have hidden newer events; callers must treat activity as a display
 * sample rather than an exhaustive statistic.
 */
export async function collectRecentActivity({
  rest,
  username,
  repositories,
  settings,
  now = new Date(),
  logger = silentLogger,
} = {}) {
  if (!rest) {
    throw new TypeError('rest must be an authenticated Octokit client');
  }
  if (typeof username !== 'string' || username.trim() === '') {
    throw new TypeError('username must be a non-empty GitHub login');
  }
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array of validated repository records');
  }
  assertSettings(settings);

  const nowDate = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new TypeError('now must be a valid date');
  }
  const cutoff = new Date(nowDate.getTime() - settings.maxAgeDays * DAY_MS);

  const listed = await listPublicEvents({
    octokit: rest,
    username,
    perPage: 100,
    maxPages: settings.maxPages,
  });

  const { publicByName, privateByName } = repositoryMaps(repositories);
  const seenEventIds = new Set();
  const items = [];

  let scannedEventCount = 0;
  let skippedUnknownRepositoryCount = 0;
  let skippedUnsupportedTypeCount = 0;
  let duplicateEventCount = 0;
  let stoppedAtAge = false;

  for (const event of listed.events) {
    scannedEventCount += 1;
    const createdAt = new Date(event.created_at);
    if (createdAt.getTime() < cutoff.getTime()) {
      // GitHub returns events newest-first. Once an event is older than the
      // configured window, every following event is older too.
      stoppedAtAge = true;
      break;
    }

    const key = event.repo.name.toLowerCase();
    if (privateByName.has(key)) {
      throw new ActivityCollectionError(
        'The public activity feed referenced a private repository. ' +
          'Collection cannot continue because activity output could leak private metadata.',
        { code: 'ACTIVITY_PRIVATE_REPOSITORY_EVENT' },
      );
    }

    const repository = publicByName.get(key);
    if (!repository) {
      skippedUnknownRepositoryCount += 1;
      continue;
    }

    if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
      skippedUnsupportedTypeCount += 1;
      continue;
    }

    if (seenEventIds.has(event.id)) {
      duplicateEventCount += 1;
      continue;
    }
    seenEventIds.add(event.id);

    items.push(
      Object.freeze({
        id: event.id,
        type: event.type,
        repository: repository.full_name,
        createdAt: createdAt.toISOString(),
      }),
    );

    if (items.length >= settings.limit) break;
  }

  const result = Object.freeze({
    items: Object.freeze(items),
    coverage: Object.freeze({
      pagesFetched: listed.pages,
      scannedEventCount,
      includedEventCount: items.length,
      skippedUnknownRepositoryCount,
      skippedUnsupportedTypeCount,
      duplicateEventCount,
      stoppedAtAge,
      truncated: listed.truncated,
      complete: !listed.truncated,
    }),
  });

  logger.info('Public activity collection completed.', {
    pagesFetched: result.coverage.pagesFetched,
    includedEventCount: result.coverage.includedEventCount,
    truncated: result.coverage.truncated,
  });

  return result;
}
