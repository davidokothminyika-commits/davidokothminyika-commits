import { repositorySchema } from '../schemas/github.schema.js';
import { GitHubResponseError } from './errors.js';
import { paginateRest } from './pagination.js';

const DISCOVERY_OPERATION = 'repository discovery';

function assertVisibility(visibility) {
  if (!['all', 'public', 'private'].includes(visibility)) {
    throw new RangeError('visibility must be "all", "public" or "private"');
  }
}

/**
 * Enumerate every repository owned by the authenticated user that the token can
 * access. Collaborator and organization repositories are deliberately excluded:
 * this profile reports work owned by the profile account.
 *
 * A successful response is not treated as complete coverage. The collector
 * compares these results with the authenticated user's repository counts.
 */
export async function listOwnedRepositories({
  octokit,
  visibility = 'all',
  perPage = 100,
  maxPages = 20,
} = {}) {
  assertVisibility(visibility);

  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new RangeError('perPage must be an integer between 1 and 100');
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new RangeError('maxPages must be a positive integer');
  }

  const page = await paginateRest({
    octokit,
    route: 'GET /user/repos',
    parameters: {
      affiliation: 'owner',
      visibility,
      sort: 'full_name',
      direction: 'asc',
      per_page: perPage,
    },
    maxPages,
    operation: DISCOVERY_OPERATION,
    requireArrayPages: true,
  });

  const repositories = [];
  for (const [index, item] of page.items.entries()) {
    const parsed = repositorySchema.safeParse(item);
    if (!parsed.success) {
      throw new GitHubResponseError({
        operation: DISCOVERY_OPERATION,
        code: 'GITHUB_INVALID_REPOSITORY_RESPONSE',
        message:
          `GitHub returned an invalid repository record at position ${index} during ` +
          `${DISCOVERY_OPERATION}. Collection cannot continue with unvalidated data.`,
      });
    }
    repositories.push(parsed.data);
  }

  return Object.freeze({
    repositories: Object.freeze(repositories),
    pages: page.pages,
  });
}
