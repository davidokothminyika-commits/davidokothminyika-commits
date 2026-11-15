import { describe, expect, it, vi } from 'vitest';

import {
  GitHubApiError,
  paginateRest,
  PaginationLimitError,
  UnexpectedPageError,
} from '../../src/api/index.js';

function createIteratorClient(pages) {
  return {
    paginate: {
      iterator: vi.fn(() => {
        return (async function* iterate() {
          for (const page of pages) {
            yield page;
          }
        })();
      }),
    },
  };
}

function page(items, link) {
  return {
    data: items,
    headers: link ? { link } : {},
  };
}

describe('paginateRest', () => {
  it('collects pages beyond 100 items and reports progress', async () => {
    const octokit = createIteratorClient([
      page(Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))),
      page([{ id: 101 }, { id: 102 }], '<https://api.github.com/next>; rel="next"'),
      page([{ id: 103 }]),
    ]);
    const route = { method: 'GET', url: '/user/repos' };
    const onPage = vi.fn();

    const result = await paginateRest({
      octokit,
      route,
      parameters: { affiliation: 'owner', per_page: 100 },
      maxPages: 5,
      onPage,
    });

    expect(result.pages).toBe(3);
    expect(result.items).toHaveLength(103);
    expect(result.items.at(-1)).toEqual({ id: 103 });
    expect(octokit.paginate.iterator).toHaveBeenCalledWith(route, {
      affiliation: 'owner',
      per_page: 100,
    });
    expect(onPage).toHaveBeenCalledTimes(3);
    expect(onPage).toHaveBeenNthCalledWith(1, {
      page: 1,
      items: expect.any(Array),
      totalItems: 100,
    });
    expect(onPage).toHaveBeenLastCalledWith({
      page: 3,
      items: [{ id: 103 }],
      totalItems: 103,
    });
  });

  it('accepts exactly the maximum number of pages when no next page exists', async () => {
    const octokit = createIteratorClient([page([{ id: 1 }]), page([{ id: 2 }])]);

    const result = await paginateRest({ octokit, route: {}, maxPages: 2 });

    expect(result).toMatchObject({ pages: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('fails rather than silently truncating when the page cap is exceeded', async () => {
    const octokit = createIteratorClient([page([{ id: 1 }]), page([{ id: 2 }]), page([{ id: 3 }])]);

    await expect(paginateRest({ octokit, route: {}, maxPages: 2 })).rejects.toBeInstanceOf(
      PaginationLimitError,
    );
  });

  it('fails without fetching an extra page when the cap is reached and a next link exists', async () => {
    let yielded = 0;
    const octokit = {
      paginate: {
        iterator: () => {
          return (async function* iterate() {
            for (const current of [
              page([{ id: 1 }], '<https://api.github.com/next>; rel="next"'),
              page([{ id: 2 }]),
            ]) {
              yielded += 1;
              yield current;
            }
          })();
        },
      },
    };

    await expect(paginateRest({ octokit, route: {}, maxPages: 1 })).rejects.toMatchObject({
      code: 'GITHUB_PAGINATION_LIMIT',
    });
    expect(yielded).toBe(1);
  });

  it('normalizes API failures without exposing private repository names', async () => {
    const privateName = 'private-repository-name';
    const octokit = {
      paginate: {
        iterator: () => {
          throw Object.assign(
            new Error(`Not Found - https://api.github.com/repos/owner/${privateName}/languages`),
            { status: 404 },
          );
        },
      },
    };

    let caught;
    try {
      await paginateRest({
        octokit,
        route: {},
        operation: 'repository language collection',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GitHubApiError);
    expect(caught.code).toBe('GITHUB_NOT_FOUND');
    expect(caught.message).not.toContain(privateName);
    expect(JSON.stringify(caught)).not.toContain(privateName);
  });

  it('handles empty result sets and non-array pages', async () => {
    expect((await paginateRest({ octokit: createIteratorClient([]), route: {} })).items).toEqual(
      [],
    );
    expect(
      (
        await paginateRest({
          octokit: createIteratorClient([{ data: null, headers: {} }]),
          route: {},
        })
      ).items,
    ).toEqual([]);
  });

  it('rejects non-array pages when strict array pages are required', async () => {
    await expect(
      paginateRest({
        octokit: createIteratorClient([{ data: { message: 'unexpected' }, headers: {} }]),
        route: {},
        requireArrayPages: true,
        operation: 'repository discovery',
      }),
    ).rejects.toBeInstanceOf(UnexpectedPageError);
  });

  it('validates arguments and callback types', async () => {
    await expect(paginateRest({})).rejects.toThrow(TypeError);
    await expect(
      paginateRest({ octokit: createIteratorClient([]), route: {}, maxPages: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(
      paginateRest({ octokit: createIteratorClient([]), route: {}, onPage: 'not-a-function' }),
    ).rejects.toThrow(TypeError);
  });
});
