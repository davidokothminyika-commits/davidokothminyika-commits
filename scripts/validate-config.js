#!/usr/bin/env node
import { loadConfig } from '../src/config/index.js';
import { loadEnv } from '../src/config/env.js';

try {
  const config = loadConfig();
  const env = loadEnv();
  const { profile, collection, rendering, threeDThemes } = config;

  console.log('Configuration valid.');
  console.log(`  Profile: ${profile.github.username}/${profile.github.repository}`);
  console.log(`  Collection visibility: ${collection.visibility}`);
  console.log(`  Forks included: ${collection.includeForks}`);
  console.log(`  Archived included: ${collection.includeArchived}`);
  console.log(`  Private coverage required: ${collection.requirePrivateCoverage}`);
  console.log(
    `  Language concurrency: ${collection.languages.concurrency}; ` +
      `private aggregation: ${collection.languages.includePrivate}; ` +
      `failure policy: ${collection.languages.failurePolicy}`,
  );
  console.log(`  Featured mode: ${profile.featured.mode}`);
  console.log(`  Output: ${rendering.output.readme}`);
  console.log(`  3D graph variants: ${threeDThemes.map((theme) => theme.fileName).join(', ')}`);
  console.log(
    `  PROFILE_GITHUB_TOKEN: ${env.PROFILE_GITHUB_TOKEN ? 'configured' : 'not configured'}`,
  );
} catch (error) {
  console.error(error.name === 'ConfigError' || error.name === 'EnvError' ? error.message : error);
  process.exitCode = 1;
}
