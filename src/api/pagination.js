import { normalizeApiError, PaginationLimitError, UnexpectedPageError } from './errors.js';

function hasNextPage(linkHeader) {
  if (typeof linkHeader !== 'string') return false;
  return linkHeader.split(',').some((part) => /rel="next"/.test(part) && /<[^>]+>/.test(part));
}

/**
 * Iterate a paginated REST endpoint with a hard page cap.
 *
 * Exceeding the cap is an error, not a silent truncation: publishing partial
 * repository coverage would produce incorrect statistics. `operation` must be
 * a static description and must not contain private repository identifiers.
 */
export async function paginateRest({
  octokit,
  route,
  parameters = {},
  maxPages = 10,
  onPage,
  operation = 'REST pagination',
  requireArrayPages = false,
} = {}) {
  if (!octokit?.paginate || typeof octokit.paginate.iterator !== 'function') {
    throw new TypeError('octokit.paginate.iterator must be available');
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new RangeError('maxPages must be a positive integer');
  }
  if (onPage !== undefined && typeof onPage !== 'function') {
    throw new TypeError('onPage must be a function when provided');
  }

  const items = [];
  let pages = 0;

  try {
    const iterator = octokit.paginate.iterator(route, parameters);

    for await (const response of iterator) {
      if (pages >= maxPages) {
        throw new PaginationLimitError({ maxPages });
      }

      pages += 1;

      if (requireArrayPages && !Array.isArray(response?.data)) {
        throw new UnexpectedPageError({ operation });
      }

      const pageItems = Array.isArray(response?.data) ? response.data : [];
      items.push(...pageItems);

      if (onPage) {
        await onPage({ page: pages, items: pageItems, totalItems: items.length });
      }

      if (pages === maxPages && hasNextPage(response?.headers?.link)) {
        throw new PaginationLimitError({ maxPages });
      }
    }
  } catch (error) {
    if (error instanceof PaginationLimitError || error instanceof UnexpectedPageError) throw error;
    throw normalizeApiError(error, { operation });
  }

  return Object.freeze({ items, pages });
}
