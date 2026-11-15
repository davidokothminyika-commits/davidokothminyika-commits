import { vi } from 'vitest';

/**
 * Fake Octokit REST client for paginated repository discovery. Each page is an
 * array, or a function returning an array so tests can mutate data lazily.
 */
export function createPagedRest(pages, { request, throwOnIterator } = {}) {
  const iteratorCalls = [];

  const rest = {
    paginate: {
      iterator: vi.fn((route, parameters) => {
        iteratorCalls.push({ route, parameters });

        if (throwOnIterator) {
          return {
            [Symbol.asyncIterator]() {
              return {
                next: async () => {
                  throw throwOnIterator;
                },
              };
            },
          };
        }

        return (async function* iterate() {
          for (const [index, page] of pages.entries()) {
            const data = typeof page === 'function' ? page() : page;
            const headers =
              index < pages.length - 1
                ? { link: `<https://api.github.com/user/repos?page=${index + 2}>; rel="next"` }
                : {};
            yield { data, headers };
          }
        })();
      }),
    },
    request: vi.fn(request ?? (async () => ({ data: {} }))),
  };

  return { rest, iteratorCalls };
}

/**
 * Fake Octokit request client for per-repository language calls.
 */
export function createRequestRest(handler) {
  return {
    request: vi.fn(async (route, parameters) => handler(route, parameters)),
  };
}

/**
 * Build an Octokit-shaped error whose message contains a private URL. Callers
 * use this to assert that errors are normalised without copying that URL.
 */
export function createApiFailure(status, { headers = {}, url = null, message } = {}) {
  return Object.assign(new Error(message ?? `Request failed${url ? `: ${url}` : ''}`), {
    status,
    response: {
      status,
      headers,
      data: { message: 'upstream failure body' },
    },
  });
}
