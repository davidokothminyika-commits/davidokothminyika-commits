import { vi } from 'vitest';

export const TEST_TOKEN = `github_pat_${'a'.repeat(36)}`;

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

export function createFetchMock(handler) {
  return vi.fn(async (url, options = {}) => {
    return handler({
      url: String(url),
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      body: options.body,
      options,
    });
  });
}

export function createUser(overrides = {}) {
  return {
    login: 'davidokothminyika-commits',
    id: 238948285,
    type: 'User',
    name: 'David Okoth Minyka',
    public_repos: 7,
    total_private_repos: 2,
    owned_private_repos: 2,
    followers: 0,
    following: 3,
    ...overrides,
  };
}

export function createViewer(overrides = {}) {
  return {
    login: 'davidokothminyika-commits',
    databaseId: 238948285,
    ...overrides,
  };
}

/**
 * Plain fetch handler for the common REST /user + GraphQL /viewer flow.
 * Wrap it with createFetchMock when constructing test clients.
 */
export function githubFetchHandler({
  user = createUser(),
  viewer = createViewer(),
  graphqlStatus = 200,
} = {}) {
  return ({ url }) => {
    if (url.endsWith('/graphql')) {
      if (graphqlStatus !== 200) {
        return jsonResponse({ message: 'Bad credentials' }, { status: graphqlStatus });
      }
      return jsonResponse({ data: { viewer } });
    }

    if (url.endsWith('/user')) {
      return jsonResponse(user, {
        headers: {
          'x-oauth-scopes': 'read:user, repo',
          'x-github-request-id': 'REST-REQUEST-ID',
        },
      });
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  };
}
