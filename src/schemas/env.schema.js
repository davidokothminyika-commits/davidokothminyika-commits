import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean().default(false));

const optionalToken = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(20, 'A GitHub token must be at least 20 characters').optional(),
);

export const envSchema = z
  .object({
    PROFILE_GITHUB_TOKEN: optionalToken,
    LOG_LEVEL: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    ),
    DRY_RUN: booleanFromEnv,
    GITHUB_ACTIONS: booleanFromEnv,
    GITHUB_REPOSITORY: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Expected owner/repository')
      .optional(),
    CI: booleanFromEnv,
  })
  .passthrough();

/**
 * Validate environment variables without printing their values.
 */
export function parseEnv(environment = process.env) {
  return envSchema.parse(environment);
}
