import { silentLogger } from '../utils/logger.js';
import { deepFreeze } from '../utils/freeze.js';
import { RepositorySelectionError } from './errors.js';

function validateLimit(value) {
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new RepositorySelectionError(
      'Featured repository limit must be an integer between 1 and 12.',
    );
  }
  return value;
}

function validateRepository(repository) {
  if (
    !repository ||
    !Number.isInteger(repository.id) ||
    repository.id < 1 ||
    typeof repository.name !== 'string' ||
    typeof repository.full_name !== 'string' ||
    typeof repository.private !== 'boolean' ||
    typeof repository.fork !== 'boolean' ||
    typeof repository.archived !== 'boolean' ||
    !Number.isInteger(repository.stargazers_count) ||
    !Number.isInteger(repository.forks_count)
  ) {
    throw new RepositorySelectionError(
      'Repository ranking input contains an invalid repository record.',
    );
  }
}

function compareRepositories(left, right) {
  if (left.stargazers_count !== right.stargazers_count) {
    return right.stargazers_count - left.stargazers_count;
  }
  if (left.forks_count !== right.forks_count) {
    return right.forks_count - left.forks_count;
  }

  const leftPushed = left.pushed_at ?? '';
  const rightPushed = right.pushed_at ?? '';
  if (leftPushed !== rightPushed) {
    return rightPushed.localeCompare(leftPushed);
  }

  return left.name.localeCompare(right.name);
}

function toPublicRepository(repository, rank) {
  return {
    rank,
    name: repository.name,
    fullName: repository.full_name,
    description: typeof repository.description === 'string' ? repository.description : null,
    htmlUrl: repository.html_url,
    language: typeof repository.language === 'string' ? repository.language : null,
    topics: Array.isArray(repository.topics) ? [...repository.topics] : [],
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    pushedAt: repository.pushed_at ?? null,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
  };
}

/**
 * Rank public repositories for the featured-projects section.
 *
 * Only public repositories can be ranked or rendered. Private repositories,
 * archived repositories and (unless explicitly allowed) forks are excluded.
 * Ranking is deterministic: stars, then forks, then most recent push, then name.
 * The returned record contains public metadata only.
 */
export function rankPublicRepositories({
  repositories,
  featured = {},
  allowForks = false,
  excludeNames = [],
  limit = null,
  logger = silentLogger,
} = {}) {
  if (!Array.isArray(repositories)) {
    throw new TypeError('repositories must be an array');
  }
  if (!Array.isArray(excludeNames)) {
    throw new RepositorySelectionError('excludeNames must be an array of repository names.');
  }
  if (featured.mode !== undefined && !['automatic', 'curated'].includes(featured.mode)) {
    throw new RepositorySelectionError('featured.mode must be "automatic" or "curated".');
  }
  if (featured.mode === 'curated' && !Array.isArray(featured.repositories)) {
    throw new RepositorySelectionError('Curated featured repositories require a repository list.');
  }

  const selectedLimit = validateLimit(limit ?? featured.limit ?? 4);
  const excludedSource = Array.isArray(featured.exclude) ? featured.exclude : [];
  const excluded = new Set(
    [...excludedSource, ...excludeNames].map((name) => String(name).toLowerCase()),
  );
  const curated =
    featured.mode === 'curated'
      ? new Set(featured.repositories.map((name) => String(name).toLowerCase()))
      : null;
  const byId = new Map();

  for (const repository of repositories) {
    validateRepository(repository);
    if (repository.private) continue;
    if (repository.archived) continue;
    if (!allowForks && repository.fork) continue;
    if (curated && !curated.has(repository.name.toLowerCase())) continue;
    if (excluded.has(repository.name.toLowerCase())) continue;
    if (!byId.has(repository.id)) {
      byId.set(repository.id, repository);
    }
  }

  const ranked = [...byId.values()]
    .sort(compareRepositories)
    .map((repository, index) => toPublicRepository(repository, index + 1));

  const selected = deepFreeze(ranked.slice(0, selectedLimit));

  logger.info('Public repository ranking completed.', {
    candidateCount: byId.size,
    selectedCount: selected.length,
  });

  return selected;
}
