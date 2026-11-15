import { languageMapSchema } from '../schemas/github.schema.js';
import { silentLogger } from '../utils/logger.js';
import { AggregationError, IncompleteLanguageDataError } from './errors.js';

function compareNames(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sameLanguageMap(left, right) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([name, bytes]) => right[name] === bytes);
}

function validateCollection(collection) {
  if (
    !collection ||
    !Number.isInteger(collection.repositoryId) ||
    collection.repositoryId < 1 ||
    typeof collection.private !== 'boolean'
  ) {
    throw new AggregationError(
      'Language data contains an invalid repository identity. Aggregation cannot continue.',
      { code: 'LANGUAGE_DATA_INVALID' },
    );
  }

  const parsed = languageMapSchema.safeParse(collection.languages);
  if (!parsed.success) {
    throw new AggregationError(
      'Language data contains invalid byte counts. Aggregation cannot continue.',
      { code: 'LANGUAGE_DATA_INVALID' },
    );
  }

  return parsed.data;
}

/**
 * Assign display percentages rounded to two decimals with the largest-remainder
 * method. Exact byte counts and full-precision percentages are calculated
 * first, so display rounding never influences ranking or totals.
 */
function calculateDisplayCents(entries, totalBytes) {
  if (totalBytes === 0 || entries.length === 0) {
    return new Array(entries.length).fill(0);
  }

  const cents = new Array(entries.length);
  const remainders = new Array(entries.length);
  let assigned = 0;

  for (const [index, entry] of entries.entries()) {
    const scaled = (entry.bytes / totalBytes) * 10000;
    const base = Math.floor(scaled);
    cents[index] = base;
    remainders[index] = scaled - base;
    assigned += base;
  }

  const remaining = 10000 - assigned;

  if (remaining > 0) {
    const order = entries
      .map((_, index) => index)
      .sort(
        (left, right) =>
          remainders[right] - remainders[left] ||
          entries[right].bytes - entries[left].bytes ||
          compareNames(entries[left].name, entries[right].name),
      );

    for (let offset = 0; offset < remaining; offset += 1) {
      cents[order[offset % order.length]] += 1;
    }
  } else if (remaining < 0) {
    // Defensive: floating-point edge cases must never push display percentages
    // above 100%. Remove from the entries with the smallest remainders first.
    const order = entries
      .map((_, index) => index)
      .sort((left, right) => remainders[left] - remainders[right] || cents[right] - cents[left]);

    let removals = -remaining;
    let offset = 0;
    while (removals > 0) {
      const index = order[offset % order.length];
      if (cents[index] > 0) {
        cents[index] -= 1;
        removals -= 1;
      }
      offset += 1;
    }
  }

  return cents;
}

function rankEntries(entries) {
  let previousBytes = null;
  let previousRank = 0;

  return entries.map((entry, index) => {
    if (previousBytes === null || entry.bytes !== previousBytes) {
      previousRank = index + 1;
      previousBytes = entry.bytes;
    }
    return { ...entry, rank: previousRank };
  });
}

/**
 * Aggregate language bytes across repositories.
 *
 * Percentages use exact integer byte counts and are not rounded before the
 * calculation. `displayPercentage` is rounded to two decimal places with the
 * largest-remainder method, so displayed values sum to exactly 100.00 whenever
 * total bytes are non-zero.
 *
 * Incomplete input is rejected by default. `allowIncomplete` exists only for
 * diagnostics; the publication pipeline must not enable it.
 */
export function aggregateLanguages({
  collections,
  failures = [],
  coverage = null,
  allowIncomplete = false,
  logger = silentLogger,
} = {}) {
  if (!Array.isArray(collections)) {
    throw new TypeError('collections must be an array');
  }
  if (!Array.isArray(failures)) {
    throw new TypeError('failures must be an array');
  }

  const incomplete = failures.length > 0 || coverage?.complete === false;
  if (incomplete && !allowIncomplete) {
    throw new IncompleteLanguageDataError();
  }

  const byRepositoryId = new Map();
  const totals = new Map();
  let duplicateRepositoryCount = 0;
  let publicRepositoryCount = 0;
  let privateRepositoryCount = 0;

  for (const collection of collections) {
    const languages = validateCollection(collection);

    if (byRepositoryId.has(collection.repositoryId)) {
      const existing = byRepositoryId.get(collection.repositoryId);
      if (!sameLanguageMap(existing, languages)) {
        throw new AggregationError(
          'Language data contains conflicting records for one repository ID. Aggregation cannot continue.',
          { code: 'LANGUAGE_DATA_CONFLICT' },
        );
      }
      duplicateRepositoryCount += 1;
      continue;
    }

    byRepositoryId.set(collection.repositoryId, languages);
    if (collection.private) {
      privateRepositoryCount += 1;
    } else {
      publicRepositoryCount += 1;
    }

    for (const [name, bytes] of Object.entries(languages)) {
      const next = (totals.get(name) ?? 0) + bytes;
      if (!Number.isSafeInteger(next)) {
        throw new AggregationError(
          'Language byte totals exceed the safe integer range. Aggregation cannot continue.',
          { code: 'LANGUAGE_BYTES_OVERFLOW' },
        );
      }
      totals.set(name, next);
    }
  }

  let totalBytes = 0;
  for (const bytes of totals.values()) {
    const next = totalBytes + bytes;
    if (!Number.isSafeInteger(next)) {
      throw new AggregationError(
        'Total language bytes exceed the safe integer range. Aggregation cannot continue.',
        { code: 'LANGUAGE_BYTES_OVERFLOW' },
      );
    }
    totalBytes = next;
  }

  const baseEntries = [...totals.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((left, right) => right.bytes - left.bytes || compareNames(left.name, right.name));

  const displayCents = calculateDisplayCents(baseEntries, totalBytes);
  const ranked = rankEntries(baseEntries);

  const languages = ranked.map((entry, index) =>
    Object.freeze({
      name: entry.name,
      bytes: entry.bytes,
      percentage: totalBytes === 0 ? 0 : (entry.bytes / totalBytes) * 100,
      displayPercentage: displayCents[index] / 100,
      rank: entry.rank,
    }),
  );

  const result = Object.freeze({
    totalBytes,
    languages: Object.freeze(languages),
    includedRepositoryCount: byRepositoryId.size,
    publicRepositoryCount,
    privateRepositoryCount,
    duplicateRepositoryCount,
    incomplete,
  });

  logger.info('Language aggregation completed.', {
    totalBytes: result.totalBytes,
    languageCount: result.languages.length,
    incomplete,
  });

  return result;
}
