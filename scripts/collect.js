#!/usr/bin/env node
import { loadConfig } from '../src/config/index.js';
import { loadEnv } from '../src/config/env.js';
import { createGitHubClients } from '../src/api/index.js';
import { runProfilePipeline } from '../src/pipeline/index.js';
import { createLogger } from '../src/utils/logger.js';

try {
  const config = loadConfig();
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });
  const clients = createGitHubClients({
    token: env.PROFILE_GITHUB_TOKEN,
    logger,
  });

  const result = await runProfilePipeline({ config, logger, clients });

  const { inventory, languageSummary, statisticsSummary, featured } = result;

  console.log('Profile collection complete.');
  console.log(`  Repository discovery: ${inventory.coverage.pagesFetched} page(s) fetched.`);
  console.log(`  Languages: ${languageSummary.languages.length} detected.`);
  console.log(`  Total language bytes: ${languageSummary.totalBytes}.`);
  console.log(
    `  Top languages: ${languageSummary.languages
      .slice(0, 5)
      .map((language) => `${language.name} (${language.displayPercentage.toFixed(2)}%)`)
      .join(', ')}`,
  );
  console.log(
    `  Contributions (${statisticsSummary.contributions.window.fromDate} to ` +
      `${statisticsSummary.contributions.window.toDate}): ` +
      `${statisticsSummary.contributions.total}.`,
  );
  console.log(
    `  Active days: ${statisticsSummary.contributions.activeDays}/` +
      `${statisticsSummary.contributions.calendarDays}.`,
  );
  console.log(
    `  Streaks: current ${statisticsSummary.contributions.currentStreak}, ` +
      `longest ${statisticsSummary.contributions.longestStreak}.`,
  );
  console.log(
    `  Public repositories: ${statisticsSummary.repositories.public}; ` +
      `stars ${statisticsSummary.stars}; forks ${statisticsSummary.forks}.`,
  );
  console.log(
    `  Public activity items: ${statisticsSummary.activity.items.length} ` +
      `(feed complete: ${String(statisticsSummary.activity.complete)}).`,
  );
  console.log(
    `  Featured repositories: ${
      featured.map((repository) => repository.fullName).join(', ') || '(none)'
    }`,
  );
} catch (error) {
  // Print only the safe, actionable message. Raw API context and private
  // repository metadata are never included in these errors.
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
