#!/usr/bin/env node
import { loadConfig } from '../src/config/index.js';
import { loadEnv } from '../src/config/env.js';
import { createGitHubClients, verifyAuthenticatedUser } from '../src/api/index.js';
import { createLogger } from '../src/utils/logger.js';

try {
  const config = loadConfig();
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });
  const clients = createGitHubClients({
    token: env.PROFILE_GITHUB_TOKEN,
    logger,
  });

  const identity = await verifyAuthenticatedUser(clients, {
    expectedLogin: config.profile.github.username,
    logger,
  });

  console.log(`Authenticated as ${identity.login} (${identity.type}).`);
  console.log(`Token kind: ${identity.tokenKind}; scopes: ${identity.scopes.length}.`);
  console.log(`Public repositories: ${identity.publicRepositoryCount ?? 'unknown'}.`);
  console.log('REST and GraphQL access verified.');
} catch (error) {
  // Print only the safe, actionable message. Stack traces can expose local
  // paths and raw request context.
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
