/**
 * Fail-closed errors raised during repository and language collection.
 *
 * Messages are safe for workflow logs: they never contain repository names,
 * full names, URLs, descriptions, topics, or raw API payloads.
 */
export class CollectionError extends Error {
  constructor(message, { code = 'COLLECTION_FAILED', cause = undefined } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'CollectionError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class RepositoryCoverageError extends CollectionError {
  constructor(message, { code = 'REPOSITORY_COVERAGE_UNVERIFIED', ...options } = {}) {
    super(message, { ...options, code });
    this.name = 'RepositoryCoverageError';
  }
}

export class RepositoryOwnershipError extends CollectionError {
  constructor(
    message = 'GitHub returned a repository not owned by the authenticated profile account.',
    options = {},
  ) {
    super(message, { ...options, code: 'REPOSITORY_OWNER_MISMATCH' });
    this.name = 'RepositoryOwnershipError';
  }
}

export class RepositoryIdentityConflictError extends CollectionError {
  constructor(
    message = 'GitHub returned conflicting records for one immutable repository ID.',
    options = {},
  ) {
    super(message, { ...options, code: 'REPOSITORY_ID_CONFLICT' });
    this.name = 'RepositoryIdentityConflictError';
  }
}

export class LanguageCollectionError extends CollectionError {
  constructor(message, { code = 'LANGUAGE_COLLECTION_INCOMPLETE', ...options } = {}) {
    super(message, { ...options, code });
    this.name = 'LanguageCollectionError';
  }
}

export class ContributionCollectionError extends CollectionError {
  constructor(message, { code = 'CONTRIBUTION_COLLECTION_INCOMPLETE', ...options } = {}) {
    super(message, { ...options, code });
    this.name = 'ContributionCollectionError';
  }
}

export class ActivityCollectionError extends CollectionError {
  constructor(message, { code = 'ACTIVITY_COLLECTION_INVALID', ...options } = {}) {
    super(message, { ...options, code });
    this.name = 'ActivityCollectionError';
  }
}
