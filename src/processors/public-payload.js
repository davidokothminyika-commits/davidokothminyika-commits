import { deepFreeze } from '../utils/freeze.js';
import { silentLogger } from '../utils/logger.js';
import { assertNoPrivateRepositoryLeak } from './privacy.js';

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value;
}

function requirePublicInputs({ statistics, languages, featured }) {
  if (
    !statistics ||
    !Number.isInteger(statistics.repositories?.public) ||
    statistics.repositories.public < 0
  ) {
    throw new TypeError('A public statistics summary with a public repository count is required');
  }
  if (!languages || !Array.isArray(languages.languages)) {
    throw new TypeError('A public language summary with a languages array is required');
  }
  requireArray(featured, 'featured');

  return { statistics, languages, featured };
}

/**
 * Assemble the single publishable payload consumed by generators and templates.
 *
 * Phase 4 produces already-sanitised public views. Phase 5 binds them into one
 * object and runs the final private-repository leak guard over the combined
 * value, so no later stage can accidentally render a private identifier that
 * slipped past an individual summary check.
 *
 * The payload contains public data only: no repository records, descriptions,
 * topics, identifiers, private splits or activity event payloads.
 */
export function createPublicPayload({
  statistics,
  languages,
  featured,
  repositories,
  logger = silentLogger,
} = {}) {
  const {
    statistics: publicStatistics,
    languages: publicLanguages,
    featured: publicFeatured,
  } = requirePublicInputs({ statistics, languages, featured });

  const payload = Object.freeze({
    statistics: publicStatistics,
    languages: publicLanguages,
    featured: Object.freeze(publicFeatured),
  });

  assertNoPrivateRepositoryLeak(payload, requireArray(repositories, 'repositories'));

  const frozen = deepFreeze(payload);

  logger.info('Public payload assembled for generation.', {
    statisticsValid: true,
    languageCount: frozen.languages.languages.length,
    featuredCount: frozen.featured.length,
  });

  return frozen;
}
