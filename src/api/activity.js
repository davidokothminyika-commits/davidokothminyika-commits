import { publicEventSchema } from '../schemas/contributions.schema.js';
import { GitHubResponseError, normalizeApiError, UnexpectedPageError } from './errors.js';

const ACTIVITY_OPERATION = 'public activity collection';

function hasNextPage(headers) {
  if (!headers || typeof headers !== 'object') return false;
  const link = Object.entries(headers).find(([key]) => key.toLowerCase() === 'link')?.[1];
  if (typeof link !== 'string') return false;
  return link.split(',').some((part) => /rel="next"/.test(part) && /<[^>]+>/.test(part));
}

/**
 * Fetch the public event stream for one account.
 *
 * Only `/events/public` is used, so private repository events cannot enter the
 * activity feed. The response schema strips payloads entirely: commit
 * messages, issue titles and other free-form event data are never retained.
 *
 * Activity is a display feed, not a completeness statistic. The iterator stops
 * at `maxPages` and reports whether truncation was possible instead of silently
 * pretending the feed is exhaustive.
 */
export async function listPublicEvents({ octokit, username, perPage = 100, maxPages = 3 } = {}) {
  if (typeof username !== 'string' || username.trim() === '') {
    throw new TypeError('username must be a non-empty GitHub login');
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new RangeError('perPage must be an integer between 1 and 100');
  }
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) {
    throw new RangeError('maxPages must be an integer between 1 and 20');
  }
  if (!octokit?.paginate || typeof octokit.paginate.iterator !== 'function') {
    throw new TypeError('octokit.paginate.iterator must be available');
  }

  const events = [];
  let pages = 0;
  let truncated = false;

  let iterator;
  try {
    iterator = octokit.paginate.iterator('GET /users/{username}/events/public', {
      username: username.trim(),
      per_page: perPage,
    });
  } catch (error) {
    throw normalizeApiError(error, { operation: ACTIVITY_OPERATION });
  }

  try {
    for await (const page of iterator) {
      pages += 1;
      if (!Array.isArray(page?.data)) {
        throw new UnexpectedPageError({ operation: ACTIVITY_OPERATION });
      }
      for (const [index, item] of page.data.entries()) {
        const parsed = publicEventSchema.safeParse(item);
        if (!parsed.success) {
          throw new GitHubResponseError({
            operation: ACTIVITY_OPERATION,
            code: 'GITHUB_INVALID_EVENT_RESPONSE',
            message:
              `GitHub returned an invalid public event at position ${index} during ` +
              `${ACTIVITY_OPERATION}. Collection cannot continue with unvalidated data.`,
          });
        }
        events.push(parsed.data);
      }

      if (pages >= maxPages) {
        truncated = hasNextPage(page.headers ?? null);
        break;
      }
    }
  } catch (error) {
    if (error instanceof UnexpectedPageError || error instanceof GitHubResponseError) {
      throw error;
    }
    throw normalizeApiError(error, { operation: ACTIVITY_OPERATION });
  }

  return Object.freeze({
    events: Object.freeze(
      events.map((event) => Object.freeze({ ...event, repo: Object.freeze({ ...event.repo }) })),
    ),
    pages,
    truncated,
  });
}
