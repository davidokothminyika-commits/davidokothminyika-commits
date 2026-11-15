import { z } from 'zod';

const nonNegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableText = z.string().max(2000).nullable();
const repositoryName = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Expected a GitHub repository name');
const isoDate = z.iso.datetime({ offset: true });

/**
 * The repository fields this project needs. Unknown fields are stripped rather
 * than retained: raw repository payloads may contain private metadata that
 * must not travel into later processing stages.
 */
export const repositorySchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    name: repositoryName,
    full_name: z.string().min(3).max(201),
    owner: z.object({
      login: z.string().min(1).max(39),
    }),
    private: z.boolean(),
    fork: z.boolean(),
    archived: z.boolean(),
    disabled: z.boolean(),
    description: nullableText,
    language: z.string().min(1).max(100).nullable(),
    topics: z.array(z.string().min(1).max(100)).max(100),
    stargazers_count: nonNegativeInteger,
    forks_count: nonNegativeInteger,
    watchers_count: nonNegativeInteger,
    size: nonNegativeInteger,
    created_at: isoDate,
    updated_at: isoDate,
    pushed_at: isoDate.nullable(),
    html_url: z
      .url()
      .refine((value) => value.startsWith('https://'), 'Only HTTPS repository URLs are allowed'),
  })
  .superRefine((repository, ctx) => {
    const expectedFullName = `${repository.owner.login}/${repository.name}`;
    if (repository.full_name.toLowerCase() !== expectedFullName.toLowerCase()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Repository full_name must match owner.login/name',
        path: ['full_name'],
      });
    }

    if (repository.private && !repository.html_url.startsWith('https://github.com/')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Repository html_url must be a GitHub HTTPS URL',
        path: ['html_url'],
      });
    }

    if (
      new Set(repository.topics.map((topic) => topic.toLowerCase())).size !==
      repository.topics.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Repository topics must be unique',
        path: ['topics'],
      });
    }
  });

/**
 * `GET /repos/{owner}/{repo}/languages` returns an object whose values are
 * byte counts. Language names are the only dynamic keys we accept from GitHub.
 */
export const languageMapSchema = z.record(z.string().min(1).max(100), nonNegativeInteger);
