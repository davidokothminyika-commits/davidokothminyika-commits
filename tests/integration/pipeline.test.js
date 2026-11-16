import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.js';
import { collectContributionStats } from '../../src/collectors/index.js';
import { collectLanguageStats } from '../../src/collectors/index.js';
import { collectRecentActivity } from '../../src/collectors/index.js';
import { collectRepositoryInventory } from '../../src/collectors/index.js';
import { aggregateLanguages } from '../../src/processors/index.js';
import { aggregateStatistics } from '../../src/processors/index.js';
import { createPublicLanguageSummary } from '../../src/processors/index.js';
import { createPublicPayload } from '../../src/processors/index.js';
import { rankPublicRepositories } from '../../src/processors/index.js';
import { buildTemplateContext } from '../../src/templates/index.js';
import {
  generateBannerSvg,
  renderReadme,
  validateMarkdown,
  validateSvg,
} from '../../src/generators/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { createContributionGraphql, createPublicEvent } from '../helpers/contribution-fixture.js';
import { createPagedRest } from '../helpers/fake-api.js';
import {
  createIdentity,
  createPrivateRepository,
  createRepository,
} from '../helpers/repository-fixture.js';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('profile collection to published asset pipeline', () => {
  it('runs the mocked end-to-end flow from discovery to validated Markdown', async () => {
    const config = loadConfig();
    const logger = createLogger();

    const identity = createIdentity({ publicRepositoryCount: 2, ownedPrivateRepositoryCount: 1 });
    const ownedRepositories = [
      createRepository({ id: 1, name: 'public-one' }),
      createRepository({ id: 2, name: 'public-two' }),
      createPrivateRepository({ id: 9003, name: 'secret-project' }),
    ];

    const events = [
      createPublicEvent({
        id: 'event-1',
        type: 'PushEvent',
        repository: 'davidokothminyika-commits/public-one',
        created_at: '2026-11-14T10:00:00Z',
      }),
    ];

    const { rest } = createPagedRest(
      [[ownedRepositories[0], ownedRepositories[1], ownedRepositories[2]]],
      {
        request: async (route) => {
          if (route === 'GET /repos/{owner}/{repo}/languages') {
            return { data: { JavaScript: 1200 } };
          }
          throw new Error(`Unexpected request in test: ${route}`);
        },
      },
    );

    const activityRest = createPagedRest([[events[0]]]).rest;

    const inventory = await collectRepositoryInventory({
      rest,
      collection: config.collection,
      identity,
      logger,
    });

    expect(inventory.coverage.complete).toBe(true);
    expect(inventory.repositories).toHaveLength(3);

    const languageStats = await collectLanguageStats({
      rest,
      repositories: inventory.repositories,
      settings: config.collection.languages,
      logger,
    });
    const aggregation = aggregateLanguages({
      collections: languageStats.collections,
      failures: languageStats.failures,
      coverage: languageStats.coverage,
      logger,
    });

    const contributions = await collectContributionStats({
      graphql: createContributionGraphql({
        counts: { '2026-11-15': 10 },
        repositories: [
          { fullName: 'davidokothminyika-commits/public-one', totalCount: 4 },
          { fullName: 'davidokothminyika-commits/secret-project', private: true, totalCount: 3 },
          { fullName: 'some-org/external-project', totalCount: 3 },
        ],
      }),
      settings: config.collection.contributions,
      repositories: inventory.allRepositories,
      now: NOW,
      logger,
    });

    const activity = await collectRecentActivity({
      rest: activityRest,
      username: identity.login,
      repositories: inventory.allRepositories,
      settings: config.collection.recentActivity,
      now: NOW,
      logger,
    });

    const statistics = aggregateStatistics({
      repositories: inventory.repositories,
      contributions,
      activity,
      identity,
      languages: aggregation,
      logger,
    });

    const languageSummary = createPublicLanguageSummary({
      aggregation,
      repositories: inventory.allRepositories,
      publish: config.collection.publish,
      logger,
    });

    const featured = rankPublicRepositories({
      repositories: inventory.repositories,
      featured: config.profile.featured,
      allowForks: config.collection.featuredRepositories.allowForks,
      excludeNames: [config.profile.github.repository],
      logger,
    });

    const publicPayload = createPublicPayload({
      statistics,
      languages: languageSummary,
      featured,
      repositories: inventory.allRepositories,
      logger,
    });

    const context = buildTemplateContext({ config, publicPayload, identity, now: NOW });
    const { markdown } = renderReadme({
      context,
      source: readFileSync(join(process.cwd(), 'main.mustache'), 'utf8'),
    });
    const markdownValidation = validateMarkdown({
      markdown,
      repositories: inventory.allRepositories,
    });

    const banner = generateBannerSvg({
      width: config.rendering.layout.maxWidth,
      height: 220,
      colors: config.rendering.theme.colors,
      title: config.profile.identity.name,
    });
    const bannerValidation = validateSvg({
      svg: banner,
      background: config.rendering.theme.colors.background,
      width: config.rendering.layout.maxWidth,
      height: 220,
    });

    expect(markdownValidation.valid).toBe(true);
    expect(bannerValidation.valid).toBe(true);
    expect(markdown).toContain(config.profile.identity.name);
    expect(markdown).not.toContain('secret-project');
    expect(JSON.stringify(publicPayload)).not.toContain('secret-project');

    // The rendered README embeds the generated SVG assets with alt text.
    expect(markdown).toContain('<img src="assets/generated/banner.svg"');
    expect(markdown).toContain('<img src="assets/generated/languages.svg"');
    expect(markdown).toContain('<img src="assets/3d/profile-3d-contrib.svg"');
    expect(markdown).toContain('[night](assets/3d/profile-3d-contrib-night.svg)');
    expect(markdown).toContain('[purple](assets/3d/profile-3d-contrib-purple.svg)');
  });
});
