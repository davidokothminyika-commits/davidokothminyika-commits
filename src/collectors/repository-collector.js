import { listOwnedRepositories } from '../api/repositories.js';
import { silentLogger } from '../utils/logger.js';
import {
  RepositoryCoverageError,
  RepositoryIdentityConflictError,
  RepositoryOwnershipError,
} from './errors.js';

function freezeRepository(repository) {
  Object.freeze(repository.owner);
  Object.freeze(repository.topics);
  return Object.freeze(repository);
}

function expectedCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function sameIdentity(left, right) {
  return (
    left.id === right.id &&
    left.full_name.toLowerCase() === right.full_name.toLowerCase() &&
    left.owner.login.toLowerCase() === right.owner.login.toLowerCase() &&
    left.private === right.private &&
    left.html_url.toLowerCase() === right.html_url.toLowerCase()
  );
}

function deduplicate(repositories) {
  const byId = new Map();
  let duplicateCount = 0;

  for (const repository of repositories) {
    const existing = byId.get(repository.id);
    if (!existing) {
      byId.set(repository.id, repository);
      continue;
    }

    if (!sameIdentity(existing, repository)) {
      throw new RepositoryIdentityConflictError();
    }

    duplicateCount += 1;
  }

  return { repositories: [...byId.values()], duplicateCount };
}

function assertOwnership(repositories, expectedLogin) {
  const expected = expectedLogin.toLowerCase();
  for (const repository of repositories) {
    if (repository.owner.login.toLowerCase() !== expected) {
      throw new RepositoryOwnershipError();
    }
  }
}

function assertCoverage({ repositories, collection, identity }) {
  const includesPublic = collection.visibility !== 'private';
  const includesPrivate = collection.visibility !== 'public';

  const observedPublic = repositories.filter((repository) => !repository.private).length;
  const observedPrivate = repositories.filter((repository) => repository.private).length;

  let publicCoverage = 'not-collected';
  let privateCoverage = 'not-collected';

  if (includesPublic) {
    const expectedPublic = expectedCount(identity?.publicRepositoryCount);
    if (expectedPublic === null) {
      throw new RepositoryCoverageError(
        'The authenticated user response did not include a public repository count. ' +
          'Repository coverage cannot be established.',
        { code: 'PUBLIC_REPOSITORY_COVERAGE_UNVERIFIED' },
      );
    }
    if (observedPublic !== expectedPublic) {
      throw new RepositoryCoverageError(
        'Repository discovery is incomplete: the number of observed public repositories does not ' +
          'match the authenticated account. Check token scopes, SSO authorization and ' +
          'collection.pagination.maxPages.',
        { code: 'PUBLIC_REPOSITORY_COVERAGE_MISMATCH' },
      );
    }
    publicCoverage = 'verified';
  }

  if (includesPrivate) {
    const expectedPrivate = expectedCount(identity?.ownedPrivateRepositoryCount);

    if (expectedPrivate === null) {
      if (collection.requirePrivateCoverage) {
        throw new RepositoryCoverageError(
          'Private repository coverage cannot be established because GitHub did not return an ' +
            'owned private repository count. Use a token with classic read:user scope or a ' +
            'fine-grained token that can read the profile private counts.',
          { code: 'PRIVATE_REPOSITORY_COVERAGE_UNVERIFIED' },
        );
      }
      privateCoverage = 'unverified-not-required';
    } else if (observedPrivate !== expectedPrivate) {
      throw new RepositoryCoverageError(
        'Repository discovery is incomplete: the number of observed private repositories does not ' +
          'match the authenticated account. Check token repository access, organization SSO ' +
          'authorization and collection.pagination.maxPages.',
        { code: 'PRIVATE_REPOSITORY_COVERAGE_MISMATCH' },
      );
    } else {
      privateCoverage = collection.requirePrivateCoverage ? 'verified' : 'observed-not-required';
    }
  }

  return Object.freeze({
    visibility: collection.visibility,
    publicRepositoryCount: observedPublic,
    privateRepositoryCount: observedPrivate,
    publicCoverage,
    privateCoverage,
  });
}

function applyFilters(repositories, collection) {
  const excludedNames = new Set(collection.excludeRepositories.map((name) => name.toLowerCase()));

  const filters = {
    excludedByName: 0,
    excludedForks: 0,
    excludedArchived: 0,
    excludedEmpty: 0,
    included: 0,
  };

  const included = [];
  for (const repository of repositories) {
    if (excludedNames.has(repository.name.toLowerCase())) {
      filters.excludedByName += 1;
      continue;
    }
    if (!collection.includeForks && repository.fork) {
      filters.excludedForks += 1;
      continue;
    }
    if (!collection.includeArchived && repository.archived) {
      filters.excludedArchived += 1;
      continue;
    }
    // GitHub reports an empty repository as size 0. A repository can have no
    // detected languages and a non-zero size; that is not an empty repository.
    if (!collection.includeEmpty && repository.size === 0) {
      filters.excludedEmpty += 1;
      continue;
    }

    included.push(repository);
    filters.included += 1;
  }

  return { included: Object.freeze(included), filters: Object.freeze(filters) };
}

/**
 * Discover all repositories owned by the authenticated account, verify that the
 * observed public/private counts match the account's reported counts, and apply
 * the configured inclusion rules.
 *
 * Any coverage uncertainty aborts collection. Filters run after coverage so an
 * excluded fork or archived repository cannot mask an inaccessible repository.
 */
export async function collectRepositoryInventory({
  rest,
  collection,
  identity,
  logger = silentLogger,
} = {}) {
  if (!rest || typeof rest.paginate?.iterator !== 'function') {
    throw new TypeError('rest must be an authenticated Octokit client');
  }
  if (!collection || !Array.isArray(collection.excludeRepositories)) {
    throw new TypeError('collection configuration is required');
  }
  if (!identity || typeof identity.login !== 'string') {
    throw new TypeError('verified identity is required');
  }

  const listed = await listOwnedRepositories({
    octokit: rest,
    visibility: collection.visibility,
    perPage: collection.pagination.perPage,
    maxPages: collection.pagination.maxPages,
  });

  const frozenList = listed.repositories.map(freezeRepository);
  const deduplicated = deduplicate(frozenList);
  assertOwnership(deduplicated.repositories, identity.login);

  const coverage = assertCoverage({
    repositories: deduplicated.repositories,
    collection,
    identity,
  });

  const filtered = applyFilters(deduplicated.repositories, collection);

  const result = Object.freeze({
    repositories: filtered.included,
    // Retained only for the privacy boundary's leak check. Never pass this
    // collection to a generator or write it to a tracked file.
    allRepositories: Object.freeze([...deduplicated.repositories]),
    coverage: Object.freeze({
      ...coverage,
      pagesFetched: listed.pages,
      discoveredRepositoryCount: deduplicated.repositories.length,
      duplicateRepositoryCount: deduplicated.duplicateCount,
      includedRepositoryCount: filtered.included.length,
      filters: filtered.filters,
      complete: true,
    }),
  });

  logger.info('Repository discovery completed.', {
    visibility: coverage.visibility,
    pagesFetched: result.coverage.pagesFetched,
    duplicateRepositoryCount: result.coverage.duplicateRepositoryCount,
    publicCoverage: coverage.publicCoverage,
    privateCoverage: coverage.privateCoverage,
  });

  return result;
}
