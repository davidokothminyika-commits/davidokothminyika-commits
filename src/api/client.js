import { withCustomRequest } from '@octokit/graphql';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';

import { getEnv } from '../config/env.js';
import { silentLogger } from '../utils/logger.js';
import {
  GitHubApiError,
  GitHubAuthenticationError,
  MissingTokenError,
  normalizeApiError,
} from './errors.js';

export const GITHUB_API_VERSION = '2026-03-10';
export const DEFAULT_USER_AGENT = 'davidokothminyika-profile/0.1.0';

const ResilientOctokit = Octokit.plugin(retry, throttling);

// Octokit's request-log plugin writes request URLs at debug level. Repository
// URLs can contain private names, so all Octokit internal logging is suppressed.
const SILENT_OCTOKIT_LOG = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

const VIEWER_QUERY = `query ProfileViewer {
  viewer {
    login
    databaseId
  }
}`;

function requireToken(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new MissingTokenError();
  }
  return token.trim();
}

function readHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function parseScopes(headerValue) {
  if (typeof headerValue !== 'string' || headerValue.trim() === '') return [];
  return Object.freeze(
    headerValue
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

function countOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Create authenticated REST and GraphQL clients.
 *
 * The token is held only by the Octokit instance and is deliberately not
 * returned to callers. `fetchImplementation` exists for deterministic tests.
 */
export function createGitHubClients({
  token,
  logger = silentLogger,
  userAgent = DEFAULT_USER_AGENT,
  requestRetries = 3,
  fetchImplementation,
} = {}) {
  const auth = requireToken(token);

  if (!Number.isInteger(requestRetries) || requestRetries < 0 || requestRetries > 10) {
    throw new RangeError('requestRetries must be an integer between 0 and 10');
  }

  const rest = new ResilientOctokit({
    auth,
    userAgent,
    request: {
      retries: requestRetries,
      ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
    },
    throttle: {
      onRateLimit(retryAfter, _options, _octokit, retryCount) {
        logger.warn('GitHub REST rate limit reached; retrying request.', {
          retryAfterSeconds: retryAfter,
          attempt: retryCount + 1,
        });
        return retryCount < 1;
      },
      onSecondaryRateLimit(retryAfter, _options, _octokit, retryCount) {
        logger.warn('GitHub secondary rate limit reached; retrying request.', {
          retryAfterSeconds: retryAfter,
          attempt: retryCount + 1,
        });
        return retryCount < 2;
      },
    },
    log: SILENT_OCTOKIT_LOG,
  });

  // Octokit's `headers` constructor option is not a request default in core
  // v7, so inject the API version through the request hook. This applies to
  // both REST and the GraphQL client below.
  rest.hook.wrap('request', (request, options) => {
    options.headers = {
      ...options.headers,
      'x-github-api-version': GITHUB_API_VERSION,
    };
    return request(options);
  });

  const graphql = withCustomRequest(rest.request);
  return Object.freeze({ rest, graphql });
}

/**
 * Create clients from PROFILE_GITHUB_TOKEN. The caller is responsible for
 * loading a local .env file first when needed.
 */
export function createGitHubClientsFromEnv({ environment = process.env, ...options } = {}) {
  const env = getEnv(environment);
  return createGitHubClients({ token: env.PROFILE_GITHUB_TOKEN, ...options });
}

/**
 * Verify that REST and GraphQL are authenticated to the expected user account.
 *
 * This confirms identity only. It does not prove that every owned private
 * repository is visible; Phase 3 performs that coverage check.
 */
export async function verifyAuthenticatedUser(
  { rest, graphql },
  { expectedLogin, logger = silentLogger } = {},
) {
  if (typeof expectedLogin !== 'string' || expectedLogin.trim() === '') {
    throw new TypeError('expectedLogin must be a non-empty GitHub username');
  }

  let response;
  try {
    response = await rest.request('GET /user');
  } catch (error) {
    throw normalizeApiError(error, { operation: 'authenticated user lookup' });
  }

  const user = response?.data;
  if (
    !user ||
    typeof user.login !== 'string' ||
    !Number.isInteger(user.id) ||
    typeof user.type !== 'string'
  ) {
    throw new GitHubAuthenticationError('GitHub returned an invalid authenticated-user response.', {
      code: 'GITHUB_INVALID_RESPONSE',
    });
  }

  if (user.login.toLowerCase() !== expectedLogin.trim().toLowerCase()) {
    throw new GitHubAuthenticationError(
      `The token belongs to "${user.login}", not the configured profile "${expectedLogin}". ` +
        'Use a token created by the profile account.',
      { code: 'GITHUB_LOGIN_MISMATCH' },
    );
  }

  if (user.type !== 'User') {
    throw new GitHubAuthenticationError(
      `The authenticated account is a "${user.type}" account, not a user profile.`,
      { code: 'GITHUB_NOT_A_USER_ACCOUNT' },
    );
  }

  let viewer;
  try {
    const data = await graphql(VIEWER_QUERY);
    viewer = data?.viewer;
  } catch (error) {
    throw normalizeApiError(error, { operation: 'authenticated GraphQL viewer lookup' });
  }

  if (!viewer || typeof viewer.login !== 'string' || !Number.isInteger(viewer.databaseId)) {
    throw new GitHubAuthenticationError('GitHub GraphQL returned an invalid viewer response.', {
      code: 'GITHUB_INVALID_RESPONSE',
    });
  }

  if (viewer.login.toLowerCase() !== user.login.toLowerCase() || viewer.databaseId !== user.id) {
    throw new GitHubAuthenticationError(
      'GitHub REST and GraphQL authenticated as different accounts.',
      { code: 'GITHUB_IDENTITY_MISMATCH' },
    );
  }

  const scopesHeader = readHeader(response.headers, 'x-oauth-scopes');
  const permissionsHeader = readHeader(response.headers, 'x-accepted-github-permissions');
  const tokenKind =
    scopesHeader !== undefined
      ? 'classic'
      : permissionsHeader !== undefined
        ? 'fine-grained'
        : 'unknown';

  const ownedPrivateRepositoryCount = countOrNull(user.owned_private_repos);
  const totalPrivateRepositoryCount = countOrNull(user.total_private_repos);

  const identity = Object.freeze({
    login: user.login,
    id: user.id,
    name: typeof user.name === 'string' ? user.name : null,
    type: user.type,
    publicRepositoryCount: countOrNull(user.public_repos),
    // Prefer the owned count: `total_private_repos` can include repositories the
    // account can access but does not own, which are outside this profile's
    // collection scope. Older or scope-limited responses may omit both fields.
    ownedPrivateRepositoryCount,
    totalPrivateRepositoryCount,
    privateRepositoryCount: ownedPrivateRepositoryCount ?? totalPrivateRepositoryCount,
    followers: countOrNull(user.followers),
    following: countOrNull(user.following),
    tokenKind,
    scopes: parseScopes(scopesHeader),
  });

  logger.info('Authenticated GitHub account verified.', {
    login: identity.login,
    accountType: identity.type,
    tokenKind: identity.tokenKind,
    scopeCount: identity.scopes.length,
  });

  return identity;
}

export { GitHubApiError, GitHubAuthenticationError, MissingTokenError };
