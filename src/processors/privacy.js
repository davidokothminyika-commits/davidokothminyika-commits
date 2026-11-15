import { deepFreeze } from '../utils/freeze.js';
import { silentLogger } from '../utils/logger.js';
import { PrivacyViolationError } from './errors.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsToken(haystack, needle) {
  const pattern = new RegExp(`(?<![A-Za-z0-9_.-])${escapeRegExp(needle)}(?![A-Za-z0-9_.-])`, 'i');
  return pattern.test(haystack);
}

/**
 * Extract the identifiers that must never cross the privacy boundary. Only
 * private repositories contribute identifiers. Callers must not log or persist
 * the returned values.
 */
export function collectPrivateIdentifiers(repositories) {
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }

  const ids = new Set();
  const names = new Set();
  const fullNames = new Set();
  const urls = new Set();
  const descriptions = new Set();
  const topics = new Set();

  for (const repository of repositories) {
    if (!repository || repository.private !== true) continue;

    if (Number.isInteger(repository.id)) ids.add(String(repository.id));
    if (typeof repository.name === 'string' && repository.name !== '') {
      names.add(repository.name);
    }
    if (typeof repository.full_name === 'string' && repository.full_name !== '') {
      fullNames.add(repository.full_name);
    }
    if (typeof repository.html_url === 'string' && repository.html_url !== '') {
      urls.add(repository.html_url);
    }
    if (typeof repository.description === 'string' && repository.description.trim() !== '') {
      descriptions.add(repository.description.trim());
    }
    if (Array.isArray(repository.topics)) {
      for (const topic of repository.topics) {
        if (typeof topic === 'string' && topic !== '') topics.add(topic);
      }
    }
  }

  return Object.freeze({
    ids: Object.freeze([...ids]),
    names: Object.freeze([...names]),
    fullNames: Object.freeze([...fullNames]),
    urls: Object.freeze([...urls]),
    descriptions: Object.freeze([...descriptions]),
    topics: Object.freeze([...topics]),
  });
}

const ID_KEY_PATTERN = /^(?:id|repositoryId|repoId|databaseId)s?$/i;

function collectSerializedParts(
  value,
  key = null,
  parts = { strings: [], keys: [], identityNumbers: [] },
  seen = new WeakSet(),
) {
  if (value === null || value === undefined) return parts;

  if (typeof value === 'string') {
    parts.strings.push(value);
    return parts;
  }
  if (typeof value === 'number') {
    if (key !== null && ID_KEY_PATTERN.test(key)) {
      parts.identityNumbers.push(String(value));
    }
    return parts;
  }
  if (typeof value !== 'object') return parts;
  if (seen.has(value)) return parts;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectSerializedParts(item, key, parts, seen);
    return parts;
  }

  for (const [childKey, child] of Object.entries(value)) {
    parts.keys.push(childKey);
    collectSerializedParts(child, childKey, parts, seen);
  }
  return parts;
}

/**
 * Fail closed if a candidate public value contains any private repository
 * identifier. `allowedStrings` lets legitimate public values (for example an
 * aggregate language name that happens to match a private repository name)
 * pass without weakening checks for names, URLs, descriptions and topics.
 */
export function assertNoPrivateRepositoryLeak(value, repositories, { allowedStrings = [] } = {}) {
  const identifiers = collectPrivateIdentifiers(repositories);
  const allowed = new Set(allowedStrings.map((entry) => entry.toLowerCase()));
  const parts = collectSerializedParts(value);
  const stringValues = parts.strings.map((entry) => entry.toLowerCase());

  const stringsContain = (identifiersToCheck) =>
    identifiersToCheck.some((identifier) => {
      const normalized = identifier.toLowerCase();
      return stringValues.some((candidate) => candidate.includes(normalized));
    });

  const keysContain = (identifiersToCheck) =>
    identifiersToCheck.some((identifier) => {
      const normalized = identifier.toLowerCase();
      return parts.keys.some((key) => key.toLowerCase().includes(normalized));
    });

  // Full names and URLs are distinctive. Check both values and object keys so a
  // private repository cannot be smuggled in as a map key.
  if (
    stringsContain(identifiers.fullNames) ||
    stringsContain(identifiers.urls) ||
    keysContain(identifiers.fullNames) ||
    keysContain(identifiers.urls)
  ) {
    throw new PrivacyViolationError();
  }

  for (const identifier of identifiers.ids) {
    if (parts.identityNumbers.some((candidate) => candidate === identifier)) {
      throw new PrivacyViolationError();
    }
    if (stringValues.some((candidate) => containsToken(candidate, identifier))) {
      throw new PrivacyViolationError();
    }
  }

  for (const name of identifiers.names) {
    if (allowed.has(name.toLowerCase())) continue;
    if (stringValues.some((candidate) => containsToken(candidate, name))) {
      throw new PrivacyViolationError();
    }
  }

  for (const description of identifiers.descriptions) {
    if (allowed.has(description.toLowerCase())) continue;
    if (description.length >= 8) {
      if (stringValues.some((candidate) => candidate.includes(description.toLowerCase()))) {
        throw new PrivacyViolationError();
      }
    } else if (stringValues.some((candidate) => containsToken(candidate, description))) {
      throw new PrivacyViolationError();
    }
  }

  for (const topic of identifiers.topics) {
    if (allowed.has(topic.toLowerCase())) continue;
    if (stringValues.some((candidate) => containsToken(candidate, topic))) {
      throw new PrivacyViolationError();
    }
  }

  return value;
}

/**
 * Build the only language object permitted to reach public generators.
 *
 * The summary is constructed by allow-list. It never includes repository
 * records, private repository names, URLs, descriptions, topics, identifiers or
 * individual private language breakdowns. The private repository count is
 * omitted unless explicitly enabled by configuration.
 */
export function createPublicLanguageSummary({
  aggregation,
  repositories,
  publish = {},
  logger = silentLogger,
} = {}) {
  if (!aggregation || !Array.isArray(aggregation.languages)) {
    throw new TypeError('aggregation with a languages array is required');
  }
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }

  const languages = aggregation.languages.map((language) =>
    Object.freeze({
      name: language.name,
      bytes: language.bytes,
      percentage: language.percentage,
      displayPercentage: language.displayPercentage,
      rank: language.rank,
    }),
  );

  const summary = {
    totalBytes: aggregation.totalBytes,
    publicRepositoryCount: aggregation.publicRepositoryCount,
    languages: Object.freeze(languages),
  };

  if (publish.privateRepositoryCount === true) {
    summary.privateRepositoryCount = aggregation.privateRepositoryCount;
  }

  assertNoPrivateRepositoryLeak(summary, repositories, {
    allowedStrings: languages.map((language) => language.name),
  });

  const frozen = Object.freeze(summary);

  logger.info('Public language summary prepared.', {
    totalBytes: frozen.totalBytes,
    languageCount: frozen.languages.length,
    privateRepositoryCountPublished: Object.hasOwn(frozen, 'privateRepositoryCount'),
  });

  return frozen;
}

function publicActivityItem(item) {
  if (
    !item ||
    typeof item.type !== 'string' ||
    typeof item.repository !== 'string' ||
    typeof item.createdAt !== 'string'
  ) {
    throw new TypeError('activity items must contain type, repository and createdAt strings');
  }
  return {
    type: item.type,
    repository: item.repository,
    createdAt: item.createdAt,
  };
}

/**
 * Build the only statistics object permitted to reach public generators.
 *
 * The summary is allow-listed. It omits every public/private split that could
 * expose an individual private repository, and it never includes repository
 * records, descriptions, topics or identifiers. Aggregate totals may include
 * private contributions. A private repository count is published only when
 * `publish.privateRepositoryCount` is explicitly enabled.
 *
 * Activity items are reduced to their event type, public repository full name
 * and timestamp. Event IDs, payloads and commit messages are deliberately
 * dropped.
 */
export function createPublicStatisticsSummary({
  statistics,
  repositories,
  publish = {},
  logger = silentLogger,
} = {}) {
  if (
    !statistics ||
    !statistics.repositories ||
    !Number.isInteger(statistics.repositories.public) ||
    statistics.repositories.public < 0
  ) {
    throw new TypeError('statistics with a valid public repository count is required');
  }
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }

  const summary = {
    repositories: {
      public: statistics.repositories.public,
    },
    stars: statistics.stars,
    forks: statistics.forks,
    contributions: statistics.contributions
      ? {
          total: statistics.contributions.total,
          activeDays: statistics.contributions.activeDays,
          calendarDays: statistics.contributions.calendarDays,
          activeDayPercentage: statistics.contributions.activeDayPercentage,
          currentStreak: statistics.contributions.currentStreak,
          longestStreak: statistics.contributions.longestStreak,
          commits: statistics.contributions.commits,
          issues: statistics.contributions.issues,
          pullRequests: statistics.contributions.pullRequests,
          reviews: statistics.contributions.reviews,
          repositories: statistics.contributions.repositories,
          window: statistics.contributions.window
            ? {
                fromDate: statistics.contributions.window.fromDate,
                toDate: statistics.contributions.window.toDate,
              }
            : null,
        }
      : null,
    languages: statistics.languages
      ? {
          totalBytes: statistics.languages.totalBytes,
          languageCount: statistics.languages.languageCount,
        }
      : null,
    activity: statistics.activity
      ? {
          items: statistics.activity.items.map(publicActivityItem),
          ...(typeof statistics.activity.coverage?.complete === 'boolean'
            ? { complete: statistics.activity.coverage.complete }
            : {}),
        }
      : null,
  };

  if (Number.isInteger(statistics.followers)) {
    summary.followers = statistics.followers;
  }
  if (Number.isInteger(statistics.following)) {
    summary.following = statistics.following;
  }

  if (publish.privateRepositoryCount === true) {
    summary.repositories.total = statistics.repositories.total;
    summary.repositories.private = statistics.repositories.private;
  }

  const allowedStrings = Array.isArray(statistics?.languages?.languages)
    ? statistics.languages.languages
        .map((language) => language?.name)
        .filter((name) => typeof name === 'string')
    : [];
  assertNoPrivateRepositoryLeak(summary, repositories, { allowedStrings });

  const frozen = deepFreeze(summary);

  logger.info('Public statistics summary prepared.', {
    repositoryCount: frozen.repositories.public,
    starCount: frozen.stars,
    contributionCount: frozen.contributions?.total ?? null,
    activityCount: frozen.activity?.items.length ?? 0,
    privateRepositoryCountPublished: Object.hasOwn(frozen.repositories, 'private'),
  });

  return frozen;
}
