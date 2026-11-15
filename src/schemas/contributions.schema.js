import { z } from 'zod';

import { isValidDateString } from '../utils/dates.js';

const nonNegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const dateString = z
  .string()
  .refine((value) => isValidDateString(value), 'Expected a real calendar date in YYYY-MM-DD form');

const contributionDaySchema = z.object({
  date: dateString,
  contributionCount: nonNegativeInteger,
  weekday: z.number().int().min(0).max(6),
});

const contributionWeekSchema = z.object({
  firstDay: dateString,
  contributionDays: z.array(contributionDaySchema).min(1).max(7),
});

const contributionCalendarSchema = z.object({
  totalContributions: nonNegativeInteger,
  weeks: z.array(contributionWeekSchema).min(1).max(60),
});

const commitContributionsByRepositorySchema = z.object({
  repository: z.object({
    nameWithOwner: z
      .string()
      .min(3)
      .max(201)
      .regex(/^[^\s/]+\/[^\s/]+$/, 'Expected an owner/repository full name'),
    isPrivate: z.boolean(),
  }),
  contributions: z.object({
    totalCount: nonNegativeInteger,
  }),
});

export const contributionsCollectionSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  totalCommitContributions: nonNegativeInteger,
  totalIssueContributions: nonNegativeInteger,
  totalPullRequestContributions: nonNegativeInteger,
  totalPullRequestReviewContributions: nonNegativeInteger,
  totalRepositoryContributions: nonNegativeInteger,
  restrictedContributionsCount: nonNegativeInteger,
  totalContributions: nonNegativeInteger,
  contributionCalendar: contributionCalendarSchema,
  commitContributionsByRepository: z
    .array(commitContributionsByRepositorySchema)
    .max(100)
    .default([]),
});

export const contributionsResponseSchema = z.object({
  viewer: z
    .object({
      contributionsCollection: contributionsCollectionSchema,
    })
    .nullable(),
});

export const publicEventSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(80),
  repo: z.object({
    name: z.string().min(3).max(201),
  }),
  created_at: z.iso.datetime({ offset: true }),
});
