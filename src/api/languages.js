import { languageMapSchema } from '../schemas/github.schema.js';
import { GitHubResponseError, normalizeApiError } from './errors.js';

const LANGUAGE_OPERATION = 'repository language collection';

/**
 * Fetch the language byte map for one repository.
 *
 * An empty object is a valid response for a repository with no detected
 * languages. Any failure is thrown; callers must never substitute an empty map
 * for a failed request. No repository name or URL is copied into an error.
 */
export async function fetchRepositoryLanguages({ octokit, repository } = {}) {
  if (
    !repository ||
    typeof repository.owner !== 'string' ||
    repository.owner.trim() === '' ||
    typeof repository.name !== 'string' ||
    repository.name.trim() === ''
  ) {
    throw new TypeError('repository must include owner and name');
  }

  let response;
  try {
    response = await octokit.request('GET /repos/{owner}/{repo}/languages', {
      owner: repository.owner,
      repo: repository.name,
    });
  } catch (error) {
    throw normalizeApiError(error, { operation: LANGUAGE_OPERATION });
  }

  const parsed = languageMapSchema.safeParse(response?.data);
  if (!parsed.success) {
    throw new GitHubResponseError({
      operation: LANGUAGE_OPERATION,
      code: 'GITHUB_INVALID_LANGUAGE_RESPONSE',
      message:
        'GitHub returned an invalid language byte map during repository language collection. ' +
        'Collection cannot continue with unvalidated data.',
    });
  }

  return Object.freeze({ ...parsed.data });
}
