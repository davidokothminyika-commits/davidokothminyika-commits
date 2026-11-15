import { fetchRepositoryLanguages } from '../api/languages.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { silentLogger } from '../utils/logger.js';
import { LanguageCollectionError } from './errors.js';

const FATAL_CODES = new Set([
  'GITHUB_AUTHENTICATION_FAILED',
  'GITHUB_RATE_LIMITED',
  'GITHUB_INVALID_LANGUAGE_RESPONSE',
]);

function assertSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('language collection settings are required');
  }
  if (!Number.isInteger(settings.concurrency) || settings.concurrency < 1) {
    throw new RangeError('languages.concurrency must be a positive integer');
  }
  if (typeof settings.includePrivate !== 'boolean') {
    throw new TypeError('languages.includePrivate must be a boolean');
  }
  if (!['fail', 'skip'].includes(settings.failurePolicy)) {
    throw new RangeError('languages.failurePolicy must be "fail" or "skip"');
  }
}

function isFatal(error) {
  return FATAL_CODES.has(error?.code);
}

function failureRecord(repository, error) {
  return Object.freeze({
    repositoryId: repository.id,
    private: repository.private,
    code: typeof error?.code === 'string' ? error.code : 'LANGUAGE_REQUEST_FAILED',
    fatal: isFatal(error),
  });
}

/**
 * Fetch language byte maps for the included repositories with bounded
 * concurrency.
 *
 * A failed private language request is never converted to an empty map. With
 * the default `fail` policy any failure aborts. With `skip`, failures are
 * recorded and the result is explicitly marked incomplete; aggregation refuses
 * incomplete input unless the caller explicitly overrides it.
 *
 * Authentication, rate-limit and malformed-response failures are always fatal,
 * regardless of the configured policy.
 */
export async function collectLanguageStats({
  rest,
  repositories,
  settings,
  logger = silentLogger,
} = {}) {
  if (!rest || typeof rest.request !== 'function') {
    throw new TypeError('rest must be an authenticated Octokit client');
  }
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }
  assertSettings(settings);

  const requested = settings.includePrivate
    ? repositories
    : repositories.filter((repository) => !repository.private);
  const skippedPrivateRepositoryCount = repositories.length - requested.length;

  const results = await mapWithConcurrency(requested, settings.concurrency, async (repository) => {
    const languages = await fetchRepositoryLanguages({
      octokit: rest,
      repository: { owner: repository.owner.login, name: repository.name },
    });
    return Object.freeze({
      repositoryId: repository.id,
      private: repository.private,
      languages,
    });
  });

  const fatalIndex = results.findIndex(
    (result) => result.status === 'rejected' && isFatal(result.reason),
  );
  if (fatalIndex !== -1) {
    throw new LanguageCollectionError(
      'Language collection aborted because GitHub reported an authentication, rate-limit or ' +
        'malformed-response failure. No language totals can be published from this run.',
      { code: 'LANGUAGE_COLLECTION_ABORTED' },
    );
  }

  const collections = [];
  const failures = [];

  for (const [index, result] of results.entries()) {
    const repository = requested[index];
    if (result.status === 'fulfilled') {
      collections.push(result.value);
    } else {
      failures.push(failureRecord(repository, result.reason));
    }
  }

  if (failures.length > 0 && settings.failurePolicy === 'fail') {
    throw new LanguageCollectionError(
      'Language collection failed for one or more repositories. No partial language totals can ' +
        'be published. Fix repository access or set collection.languages.failurePolicy to "skip" ' +
        'for a diagnostic run.',
      { code: 'LANGUAGE_COLLECTION_FAILED' },
    );
  }

  const coverage = Object.freeze({
    requestedRepositoryCount: requested.length,
    collectedRepositoryCount: collections.length,
    failedRepositoryCount: failures.length,
    skippedPrivateRepositoryCount,
    publicRepositoryCount: requested.filter((repository) => !repository.private).length,
    privateRepositoryCount: requested.filter((repository) => repository.private).length,
    includesPrivate: settings.includePrivate,
    privateCoverage: settings.includePrivate ? 'included' : 'excluded-by-config',
    failurePolicy: settings.failurePolicy,
    concurrency: settings.concurrency,
    complete: failures.length === 0,
  });

  if (failures.length > 0) {
    logger.warn('Repository language collection completed with skipped failures.', {
      failedRepositoryCount: failures.length,
      failurePolicy: settings.failurePolicy,
    });
  } else {
    logger.info('Repository language collection completed.', {
      includesPrivate: settings.includePrivate,
      concurrency: settings.concurrency,
    });
  }

  return Object.freeze({
    collections: Object.freeze(collections),
    failures: Object.freeze(failures),
    coverage,
  });
}
