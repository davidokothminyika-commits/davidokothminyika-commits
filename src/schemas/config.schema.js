import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hexadecimal colour such as #22d3ee');

const repositoryName = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Expected a valid GitHub repository name');

const githubUsername = z
  .string()
  .min(1)
  .max(39)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/, 'Expected a valid GitHub username');

const httpsUrl = z
  .url()
  .refine((value) => value.startsWith('https://'), 'Only HTTPS URLs are allowed');

const email = z.email();

const socialUrl = z.string().refine((value) => {
  if (value.startsWith('mailto:')) {
    return z.email().safeParse(value.slice('mailto:'.length)).success;
  }
  return httpsUrl.safeParse(value).success;
}, 'Expected an HTTPS URL or a mailto: address');

const socialIcon = z.enum(['github', 'mail', 'linkedin', 'x', 'globe', 'code']);

const skillIcon = z.enum([
  'nodejs',
  'express',
  'mysql',
  'react',
  'js',
  'html',
  'kotlin',
  'bash',
  'git',
  'githubactions',
  'vscode',
]);

const profileSchema = z
  .object({
    github: z
      .object({
        username: githubUsername,
        repository: repositoryName,
        profileUrl: httpsUrl,
      })
      .strict(),
    identity: z
      .object({
        name: z.string().min(1).max(100),
        headline: z.string().min(1).max(160),
        location: z.string().min(1).max(120),
        about: z.array(z.string().min(1).max(400)).min(1).max(8),
      })
      .strict(),
    contact: z
      .object({
        email,
      })
      .strict(),
    socials: z
      .array(
        z
          .object({
            label: z.string().min(1).max(40),
            url: socialUrl,
            icon: socialIcon,
          })
          .strict(),
      )
      .min(1)
      .max(8),
    technology: z
      .array(
        z
          .object({
            group: z.string().min(1).max(60),
            perline: z.number().int().min(1).max(10).default(10),
            items: z
              .array(
                z
                  .object({
                    name: z.string().min(1).max(40),
                    icon: skillIcon,
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(8)
      .superRefine((groups, ctx) => {
        const seen = new Set();
        for (const group of groups) {
          for (const item of group.items) {
            const key = item.name.toLowerCase();
            if (seen.has(key)) {
              ctx.addIssue({
                code: 'custom',
                message: `Duplicate technology "${item.name}"`,
                path: [groups.indexOf(group), 'items'],
              });
            }
            seen.add(key);
          }
        }
      }),
    currentWork: z
      .object({
        projects: z
          .array(
            z
              .object({
                title: z.string().min(1).max(120),
                description: z.string().min(1).max(300),
                url: httpsUrl.optional(),
              })
              .strict(),
          )
          .max(6)
          .default([]),
        focus: z.array(z.string().min(1).max(400)).max(10).default([]),
        learning: z.array(z.string().min(1).max(400)).max(10).default([]),
      })
      .strict()
      .default({ projects: [], focus: [], learning: [] }),
    footer: z
      .object({
        message: z.string().min(1).max(300),
        showAttribution: z.boolean().default(true),
      })
      .strict()
      .optional(),
    featured: z
      .object({
        mode: z.enum(['automatic', 'curated']),
        repositories: z.array(repositoryName).max(12),
        exclude: z.array(repositoryName).max(50),
        limit: z.number().int().min(1).max(12),
      })
      .strict()
      .superRefine((featured, ctx) => {
        if (featured.mode === 'curated' && featured.repositories.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Curated featured repositories require at least one repository',
            path: ['repositories'],
          });
        }
        if (new Set(featured.repositories).size !== featured.repositories.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Featured repositories must be unique',
            path: ['repositories'],
          });
        }
        if (new Set(featured.exclude).size !== featured.exclude.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Excluded repositories must be unique',
            path: ['exclude'],
          });
        }
      }),
  })
  .strict();

const collectionSchema = z
  .object({
    visibility: z.enum(['all', 'public', 'private']),
    affiliation: z
      .string()
      .regex(
        /^(owner|collaborator|organization_member)(,(owner|collaborator|organization_member))*$/,
        'Expected a comma-separated GitHub repository affiliation list',
      ),
    includeForks: z.boolean(),
    includeArchived: z.boolean(),
    includeEmpty: z.boolean(),
    excludeRepositories: z.array(repositoryName).max(100),
    pagination: z
      .object({
        perPage: z.number().int().min(1).max(100),
        maxPages: z.number().int().min(1).max(100),
      })
      .strict(),
    languages: z
      .object({
        concurrency: z.number().int().min(1).max(16),
        includePrivate: z.boolean(),
        failurePolicy: z.enum(['fail', 'skip']),
      })
      .strict(),
    requireOwnerMatch: z.literal(true),
    requirePrivateCoverage: z.boolean(),
    publish: z
      .object({
        privateRepositoryCount: z.boolean(),
        privateLanguageBreakdown: z
          .boolean()
          .refine(
            (value) => value === false,
            'Private language breakdowns must never be published',
          ),
        privateRepositoryNames: z
          .boolean()
          .refine((value) => value === false, 'Private repository names must never be published'),
      })
      .strict(),
    recentActivity: z
      .object({
        limit: z.number().int().min(1).max(20),
        maxAgeDays: z.number().int().min(1).max(365),
        maxPages: z.number().int().min(1).max(20),
      })
      .strict(),
    contributions: z
      .object({
        windowDays: z.number().int().min(1).max(365),
        maxRepositories: z.number().int().min(1).max(100),
      })
      .strict(),
    featuredRepositories: z
      .object({
        allowForks: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((collection, ctx) => {
    if (!collection.affiliation.split(',').includes('owner')) {
      ctx.addIssue({
        code: 'custom',
        message: 'The collection affiliation must include "owner"',
        path: ['affiliation'],
      });
    }
  });

const themeSchema = z
  .object({
    name: z.string().min(1).max(40),
    colors: z
      .object({
        background: hexColor,
        surface: hexColor,
        surfaceAlt: hexColor,
        navy: hexColor,
        cyan: hexColor,
        violet: hexColor,
        green: hexColor,
        text: hexColor,
        muted: hexColor,
        border: hexColor,
      })
      .strict(),
  })
  .strict();

const threeDimensionalTargetSchema = z
  .object({
    variant: z.enum(['midnight', 'night', 'purple']),
    source: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_.-]+\.svg$/, 'Expected a generated SVG filename'),
    target: z.string().min(1).max(200),
  })
  .strict();

const renderingSchema = z
  .object({
    theme: themeSchema,
    layout: z
      .object({
        maxWidth: z.number().int().min(600).max(1600),
        languageChart: z
          .object({
            width: z.number().int().min(400).max(1600),
            height: z.number().int().min(120).max(800),
            maxLanguages: z.number().int().min(1).max(20),
            showLegend: z.boolean(),
          })
          .strict(),
        statistics: z
          .object({
            columns: z.number().int().min(1).max(6),
          })
          .strict(),
        featuredRepositories: z
          .object({
            limit: z.number().int().min(1).max(12),
          })
          .strict(),
        recentActivity: z
          .object({
            limit: z.number().int().min(1).max(20),
          })
          .strict(),
      })
      .strict(),
    assets: z
      .object({
        banner: z.string().min(1).max(200),
        languageChart: z.string().min(1).max(200),
        threeDimensional: z
          .object({
            generatorOutputDirectory: z.string().min(1).max(100),
            targets: z.array(threeDimensionalTargetSchema).min(3).max(6),
          })
          .strict(),
      })
      .strict(),
    output: z
      .object({
        readme: z.string().min(1).max(100),
        stagingDirectory: z.string().min(1).max(100),
      })
      .strict(),
    sections: z
      .object({
        hero: z.boolean(),
        about: z.boolean(),
        languages: z.boolean(),
        technology: z.boolean(),
        statistics: z.boolean(),
        threeDimensionalGraph: z.boolean(),
        languageChart: z.boolean(),
        featuredRepositories: z.boolean(),
        currentlyWorkingOn: z.boolean(),
        recentActivity: z.boolean(),
        socials: z.boolean(),
        updatedAt: z.boolean(),
        footer: z.boolean(),
      })
      .strict(),
    timestamp: z
      .object({
        label: z.string().min(1).max(40),
        locale: z.string().min(2).max(35),
        timeZone: z.string().min(1).max(60),
      })
      .strict(),
  })
  .strict();

export const threeDThemeSchema = z
  .object({
    type: z.literal('normal'),
    fileName: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_.-]+\.svg$/, 'Expected an SVG filename without directories'),
    backgroundColor: hexColor,
    foregroundColor: hexColor,
    strongColor: hexColor,
    weakColor: hexColor,
    radarColor: hexColor,
    growingAnimation: z.boolean().optional(),
    contribColors: z.array(hexColor).length(5),
  })
  .strict();

export const projectConfigSchema = z
  .object({
    profile: profileSchema,
    collection: collectionSchema,
    rendering: renderingSchema,
    threeDThemes: z.array(threeDThemeSchema).min(1).max(6),
  })
  .strict();
