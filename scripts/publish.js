#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, PROJECT_ROOT } from '../src/config/index.js';
import { loadEnv } from '../src/config/env.js';
import { createGitHubClients } from '../src/api/index.js';
import { runProfilePipeline } from '../src/pipeline/index.js';
import { createLogger } from '../src/utils/logger.js';
import {
  stageOutputs,
  publishStaged,
  PublishError,
  resolvePublishTargets,
} from '../src/publisher/index.js';
import { buildTemplateContext } from '../src/templates/index.js';
import {
  generateBannerSvg,
  generateLanguageChartSvg,
  renderReadme,
  validateMarkdown,
  validateSvg,
} from '../src/generators/index.js';

try {
  const config = loadConfig();
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });
  const clients = createGitHubClients({
    token: env.PROFILE_GITHUB_TOKEN,
    logger,
  });

  const result = await runProfilePipeline({ config, logger, clients });

  const context = buildTemplateContext({
    config,
    publicPayload: result.publicPayload,
    identity: result.identity,
    now: result.now,
  });

  const source = await readFile(join(PROJECT_ROOT, 'main.mustache'), 'utf8');
  const { markdown } = renderReadme({ context, source });
  const markdownValidation = validateMarkdown({
    markdown,
    repositories: result.inventory.allRepositories,
  });
  if (!markdownValidation.valid) {
    throw new PublishError(
      `Rendered README failed validation: ${markdownValidation.errors.join('; ')}`,
    );
  }

  const bannerSvg = generateBannerSvg({
    width: config.rendering.layout.maxWidth,
    height: 220,
    colors: config.rendering.theme.colors,
    title: config.profile.identity.name,
  });
  const bannerValidation = validateSvg({
    svg: bannerSvg,
    background: config.rendering.theme.colors.background,
    width: config.rendering.layout.maxWidth,
    height: 220,
  });
  if (!bannerValidation.valid) {
    throw new PublishError(
      `Generated banner failed validation: ${bannerValidation.errors.join('; ')}`,
    );
  }

  const languageChartSvg = generateLanguageChartSvg({
    width: config.rendering.layout.languageChart.width,
    maxLanguages: config.rendering.layout.languageChart.maxLanguages,
    showLegend: config.rendering.layout.languageChart.showLegend,
    languages: result.languageSummary.languages,
    colors: config.rendering.theme.colors,
  });
  const languageChartValidation = validateSvg({
    svg: languageChartSvg,
    background: config.rendering.theme.colors.background,
    width: config.rendering.layout.languageChart.width,
  });
  if (!languageChartValidation.valid) {
    throw new PublishError(
      `Generated language chart failed validation: ${languageChartValidation.errors.join('; ')}`,
    );
  }

  const targets = resolvePublishTargets(config);

  const outputs = [
    { target: targets.readme, content: markdown },
    { target: targets.banner, content: bannerSvg },
    { target: targets.languageChart, content: languageChartSvg },
  ];

  const staged = await stageOutputs({
    outputs,
    stagingDirectory: targets.stagingDirectory,
    rootDir: PROJECT_ROOT,
  });
  const published = await publishStaged({ staged, rootDir: PROJECT_ROOT });

  console.log('Profile publish complete.');
  for (const file of published.published) {
    console.log(`  Published: ${file.target}`);
  }
} catch (error) {
  // Print only the safe, actionable message. Raw API context and private
  // repository metadata are never included in these errors.
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
