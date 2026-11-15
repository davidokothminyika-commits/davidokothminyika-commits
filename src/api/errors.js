export class MissingTokenError extends Error {
  constructor(
    message = 'PROFILE_GITHUB_TOKEN is not configured. Add it to .env or the Actions secret store.',
  ) {
    super(message);
    this.name = 'MissingTokenError';
    this.code = 'PROFILE_GITHUB_TOKEN_MISSING';
  }
}

export class GitHubAuthenticationError extends Error {
  constructor(message, { code = 'GITHUB_AUTHENTICATION_FAILED' } = {}) {
    super(message);
    this.name = 'GitHubAuthenticationError';
    this.code = code;
  }
}

export class PaginationLimitError extends Error {
  constructor({ maxPages }) {
    super(
      `GitHub pagination exceeded the configured limit of ${maxPages} page(s). ` +
        'Increase collection.pagination.maxPages or fix the collection scope; partial data cannot be published.',
    );
    this.name = 'PaginationLimitError';
    this.code = 'GITHUB_PAGINATION_LIMIT';
    this.maxPages = maxPages;
  }
}

export class UnexpectedPageError extends Error {
  constructor({ operation = 'REST pagination' } = {}) {
    super(
      `GitHub returned a non-array page while attempting ${operation}. ` +
        'Collection cannot continue because the response structure is unexpected.',
    );
    this.name = 'UnexpectedPageError';
    this.code = 'GITHUB_UNEXPECTED_PAGE';
  }
}

export class GitHubResponseError extends Error {
  constructor({
    operation = 'GitHub API request',
    code = 'GITHUB_INVALID_RESPONSE',
    message = null,
  } = {}) {
    super(
      message ??
        `GitHub returned a response with an unexpected structure during ${operation}. ` +
          'Collection cannot continue with unvalidated data.',
    );
    this.name = 'GitHubResponseError';
    this.code = code;
    this.operation = operation;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      operation: this.operation,
    };
  }
}

export class GitHubApiError extends Error {
  constructor(
    message,
    {
      code = 'GITHUB_API_ERROR',
      status = null,
      requestId = null,
      documentationUrl = null,
      retryAfter = null,
      operation = null,
    } = {},
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.documentationUrl = documentationUrl;
    this.retryAfter = retryAfter;
    this.operation = operation;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
      documentationUrl: this.documentationUrl,
      retryAfter: this.retryAfter,
      operation: this.operation,
    };
  }
}

function readHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function parseRetryAfter(headers, status) {
  const raw = readHeader(headers, 'retry-after');
  if (raw !== undefined && raw !== null && raw !== '') {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  }

  if (status === 403 || status === 429) {
    const remaining = readHeader(headers, 'x-ratelimit-remaining');
    if (String(remaining) === '0') {
      const reset = Number(readHeader(headers, 'x-ratelimit-reset'));
      if (Number.isFinite(reset)) {
        return Math.max(0, Math.ceil(reset - Date.now() / 1000));
      }
    }
  }

  return null;
}

function safeDocumentationUrl(value) {
  return typeof value === 'string' && value.startsWith('https://docs.github.com/') ? value : null;
}

const GRAPHQL_VALIDATION_EXTENSION_CODES = new Set([
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
]);

function graphqlTypes(error) {
  if (!Array.isArray(error?.errors)) return [];
  return [
    ...new Set(error.errors.map((item) => item?.type).filter((type) => typeof type === 'string')),
  ];
}

function graphqlValidationCodes(error) {
  if (!Array.isArray(error?.errors)) return [];
  return [
    ...new Set(
      error.errors
        .map((item) => item?.extensions?.code)
        .filter((code) => typeof code === 'string' && code.trim() !== ''),
    ),
  ];
}

/**
 * Convert an Octokit/REST/GraphQL failure into a safe, actionable error.
 *
 * `operation` must be a static label such as "repository language collection".
 * Never pass an owner, repository name, URL, query, variables, response body, or
 * token in this field: errors are written to workflow logs.
 */
export function normalizeApiError(error, { operation = 'GitHub API request' } = {}) {
  if (error instanceof GitHubApiError) return error;

  const response = error?.response;
  const headers = response?.headers ?? error?.headers;
  const status = Number(error?.status ?? response?.status ?? 0) || null;
  const requestId = readHeader(headers, 'x-github-request-id') ?? null;
  const documentationUrl = safeDocumentationUrl(
    response?.data?.documentation_url ?? error?.documentation_url,
  );
  const retryAfter = parseRetryAfter(headers, status);
  const shared = { operation, status, requestId, documentationUrl, retryAfter };

  if (status === 401) {
    return new GitHubApiError(
      `GitHub rejected the token while attempting ${operation} (401). ` +
        'Verify PROFILE_GITHUB_TOKEN, its expiry, and single sign-on authorization.',
      { ...shared, code: 'GITHUB_AUTHENTICATION_FAILED' },
    );
  }

  if (status === 429 || (status === 403 && retryAfter !== null)) {
    return new GitHubApiError(
      `GitHub rate-limited ${operation}. Retry after ${retryAfter ?? 'the reset window'} seconds.`,
      { ...shared, code: 'GITHUB_RATE_LIMITED' },
    );
  }

  if (status === 403) {
    return new GitHubApiError(
      `GitHub denied access while attempting ${operation} (403). ` +
        'Check token scopes, repository access, and organization SSO authorization.',
      { ...shared, code: 'GITHUB_FORBIDDEN' },
    );
  }

  if (status === 404) {
    return new GitHubApiError(
      `GitHub could not find a resource needed for ${operation} (404). ` +
        'The resource may not exist or the token may not have access.',
      { ...shared, code: 'GITHUB_NOT_FOUND' },
    );
  }

  if (status >= 500) {
    return new GitHubApiError(
      `GitHub was unavailable while attempting ${operation} (${status}). Retry the run later.`,
      { ...shared, code: 'GITHUB_SERVER_ERROR' },
    );
  }

  // GraphQL validation failures arrive with HTTP 200, no top-level error type,
  // and the validation code under `extensions.code`. Map them to a distinct
  // stable code instead of a generic network failure.
  const validationCode = graphqlValidationCodes(error).find((code) =>
    GRAPHQL_VALIDATION_EXTENSION_CODES.has(code),
  );
  if (validationCode !== undefined) {
    return new GitHubApiError(
      `GitHub rejected the GraphQL query during ${operation} (type: ${validationCode}). ` +
        'The query does not match the GitHub GraphQL schema.',
      { ...shared, code: 'GITHUB_GRAPHQL_VALIDATION' },
    );
  }

  const types = graphqlTypes(error);
  if (types.length > 0) {
    return new GitHubApiError(
      `GitHub GraphQL returned ${types.length === 1 ? 'an error' : 'errors'} during ${operation} ` +
        `(type: ${types.slice(0, 3).join(', ')}). Check token access and the query permissions.`,
      { ...shared, code: 'GITHUB_GRAPHQL_ERROR' },
    );
  }

  if (status) {
    return new GitHubApiError(
      `GitHub API request failed during ${operation} (${status}). ` +
        'Check token access and retry if the response was transient.',
      { ...shared, code: 'GITHUB_API_ERROR' },
    );
  }

  return new GitHubApiError(
    `Unable to reach the GitHub API during ${operation}. Check network connectivity and retry.`,
    { ...shared, code: 'GITHUB_NETWORK_ERROR' },
  );
}
