import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { envSchema } from '../schemas/env.schema.js';
import { formatZodIssues } from '../utils/validation.js';
import { PROJECT_ROOT } from './index.js';

export class EnvError extends Error {
  constructor(message, issues = []) {
    super([message, ...issues].join('\n'));
    this.name = 'EnvError';
    this.issues = issues;
  }
}

/**
 * Validate process environment variables. Values are never logged by this
 * module; callers must not print the resulting object.
 */
export function getEnv(environment = process.env) {
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    throw new EnvError('Environment validation failed.', formatZodIssues(result.error));
  }
  return result.data;
}

/**
 * Load a local .env file when present, then validate the resulting process
 * environment. GitHub Actions supplies secrets directly, so no file is needed
 * in CI.
 */
export function loadEnv({ rootDir = PROJECT_ROOT, envFile = '.env' } = {}) {
  const filePath = join(resolve(rootDir), envFile);
  if (existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
  return getEnv(process.env);
}
