export class AggregationError extends Error {
  constructor(message, { code = 'LANGUAGE_AGGREGATION_FAILED' } = {}) {
    super(message);
    this.name = 'AggregationError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class IncompleteLanguageDataError extends AggregationError {
  constructor(
    message = 'Language data is incomplete and cannot be aggregated for publication. ' +
      'Resolve repository access failures or explicitly allow a diagnostic aggregation.',
    options = {},
  ) {
    super(message, { ...options, code: 'LANGUAGE_DATA_INCOMPLETE' });
    this.name = 'IncompleteLanguageDataError';
  }
}

export class StatisticsError extends Error {
  constructor(message, { code = 'STATISTICS_INVALID' } = {}) {
    super(message);
    this.name = 'StatisticsError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class ContributionStatisticsError extends StatisticsError {
  constructor(
    message = 'Contribution data cannot be summarized because it is invalid or incomplete.',
    options = {},
  ) {
    super(message, { ...options, code: 'CONTRIBUTION_STATISTICS_INVALID' });
    this.name = 'ContributionStatisticsError';
  }
}

export class RepositorySelectionError extends StatisticsError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'REPOSITORY_SELECTION_INVALID' });
    this.name = 'RepositorySelectionError';
  }
}

export class PrivacyViolationError extends Error {
  constructor(
    message = 'Public output would contain private repository metadata. Publication aborted.',
  ) {
    super(message);
    this.name = 'PrivacyViolationError';
    this.code = 'PRIVATE_REPOSITORY_LEAK';
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}
