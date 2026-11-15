import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectConfigSchema } from '../schemas/config.schema.js';
import { PathSafetyError, resolveWithin } from '../utils/paths.js';
import { formatZodIssues } from '../utils/validation.js';

export const PROJECT_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const CONFIG_FILES = Object.freeze({
  profile: 'config/profile.json',
  collection: 'config/collection.json',
  rendering: 'config/rendering.json',
  threeDThemes: 'config/3d-themes.json',
});

const REQUIRED_3D_VARIANTS = ['midnight', 'night', 'purple'];

export class ConfigError extends Error {
  constructor(message, issues = []) {
    super(
      [message, ...issues]
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n'),
    );
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

function readJsonFile(rootDir, relativePath, label) {
  const filePath = join(rootDir, relativePath);
  if (!existsSync(filePath)) {
    throw new ConfigError(`Missing configuration file: ${relativePath} (${label})`);
  }

  let contents;
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ConfigError(`Unable to read ${relativePath}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new ConfigError(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function isInside(parent, child) {
  const root = resolve(parent);
  const target = resolve(child);
  return target === root || target.startsWith(`${root}${sep}`);
}

/**
 * Enforce invariants that cannot be expressed by the JSON schemas alone,
 * particularly filesystem containment and cross-file consistency.
 */
export function validateConfig(config, rootDir = PROJECT_ROOT) {
  const errors = [];
  const { profile, rendering, threeDThemes, collection } = config;

  if (
    profile.github.profileUrl.replace(/\/$/, '') !== `https://github.com/${profile.github.username}`
  ) {
    errors.push(
      'profile.github.profileUrl must equal https://github.com/<profile.github.username>',
    );
  }

  if (
    profile.contact.email !==
    profile.socials.find((social) => social.icon === 'mail')?.url.replace(/^mailto:/, '')
  ) {
    errors.push('profile.contact.email must match the configured mailto social link');
  }

  if (profile.featured.mode === 'curated') {
    const allowed = new Set(profile.featured.repositories.map((name) => name.toLowerCase()));
    for (const excluded of profile.featured.exclude) {
      if (allowed.has(excluded.toLowerCase())) {
        errors.push(`Featured repository "${excluded}" cannot also be excluded`);
      }
    }
  }

  if (collection.visibility === 'public' && collection.requirePrivateCoverage) {
    errors.push(
      'collection.requirePrivateCoverage cannot be true when collection.visibility is "public"',
    );
  }

  if (collection.visibility === 'private' && !collection.languages.includePrivate) {
    errors.push(
      'collection.languages.includePrivate must be true when collection.visibility is "private"',
    );
  }

  if (
    rendering.layout.recentActivity.limit > collection.recentActivity.limit &&
    rendering.sections.recentActivity
  ) {
    errors.push(
      'rendering.layout.recentActivity.limit cannot exceed collection.recentActivity.limit',
    );
  }

  if (
    rendering.layout.featuredRepositories.limit > profile.featured.limit &&
    rendering.sections.featuredRepositories
  ) {
    errors.push('rendering.layout.featuredRepositories.limit cannot exceed profile.featured.limit');
  }

  try {
    new Intl.DateTimeFormat(rendering.timestamp.locale, {
      timeZone: rendering.timestamp.timeZone,
    }).format(new Date(0));
  } catch {
    errors.push(
      `Invalid timestamp locale or time zone: ${rendering.timestamp.locale} / ${rendering.timestamp.timeZone}`,
    );
  }

  const checkPath = (label, configuredPath, { requireSvg = false } = {}) => {
    try {
      const absolutePath = resolveWithin(rootDir, configuredPath);
      if (requireSvg && !absolutePath.toLowerCase().endsWith('.svg')) {
        errors.push(`${label} must point to an SVG file`);
      }
      return absolutePath;
    } catch (error) {
      if (error instanceof PathSafetyError) {
        errors.push(`${label}: ${error.message}`);
        return null;
      }
      throw error;
    }
  };

  const readmePath = checkPath('rendering.output.readme', rendering.output.readme);
  if (readmePath && !readmePath.toLowerCase().endsWith('.md')) {
    errors.push('rendering.output.readme must point to a Markdown file');
  }
  checkPath('rendering.output.stagingDirectory', rendering.output.stagingDirectory);
  checkPath(
    'rendering.assets.threeDimensional.generatorOutputDirectory',
    rendering.assets.threeDimensional.generatorOutputDirectory,
  );

  const bannerPath = checkPath('rendering.assets.banner', rendering.assets.banner, {
    requireSvg: true,
  });
  const languageChartPath = checkPath(
    'rendering.assets.languageChart',
    rendering.assets.languageChart,
    { requireSvg: true },
  );

  if (bannerPath && !isInside(join(rootDir, 'assets'), bannerPath)) {
    errors.push('rendering.assets.banner must be inside the assets directory');
  }
  if (languageChartPath && !isInside(join(rootDir, 'assets'), languageChartPath)) {
    errors.push('rendering.assets.languageChart must be inside the assets directory');
  }

  const threeDAssetsRoot = join(rootDir, 'assets', '3d');
  const themeFileNames = new Set();
  for (const [index, theme] of threeDThemes.entries()) {
    if (themeFileNames.has(theme.fileName)) {
      errors.push(`Duplicate 3D theme filename: ${theme.fileName} (index ${index})`);
    }
    themeFileNames.add(theme.fileName);
  }

  const targetSources = new Set();
  const targetPaths = new Set();
  const targetVariants = new Set();

  for (const [index, target] of rendering.assets.threeDimensional.targets.entries()) {
    const label = `rendering.assets.threeDimensional.targets[${index}]`;

    if (targetSources.has(target.source)) {
      errors.push(`Duplicate 3D source filename: ${target.source}`);
    }
    if (targetPaths.has(target.target)) {
      errors.push(`Duplicate 3D target path: ${target.target}`);
    }
    if (targetVariants.has(target.variant)) {
      errors.push(`Duplicate 3D graph variant: ${target.variant}`);
    }
    targetSources.add(target.source);
    targetPaths.add(target.target);
    targetVariants.add(target.variant);

    if (!themeFileNames.has(target.source)) {
      errors.push(
        `${label}.source "${target.source}" has no matching entry in config/3d-themes.json`,
      );
    }

    const absoluteTarget = checkPath(`${label}.target`, target.target, { requireSvg: true });
    if (absoluteTarget && !isInside(threeDAssetsRoot, absoluteTarget)) {
      errors.push(`${label}.target must be inside assets/3d`);
    }
  }

  for (const variant of REQUIRED_3D_VARIANTS) {
    if (!targetVariants.has(variant)) {
      errors.push(`Missing required 3D graph variant: ${variant}`);
    }
  }

  for (const fileName of themeFileNames) {
    if (!targetSources.has(fileName)) {
      errors.push(`3D theme "${fileName}" is not mapped to a rendered asset target`);
    }
  }

  if (errors.length > 0) {
    throw new ConfigError('Configuration invariants failed.', errors);
  }

  return config;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Load and validate every configuration file. Configuration is read once and
 * deeply frozen so later phases cannot mutate profile data.
 */
export function loadConfig({ rootDir = PROJECT_ROOT, files = CONFIG_FILES } = {}) {
  const resolvedRoot = resolve(rootDir);
  const candidate = {
    profile: readJsonFile(resolvedRoot, files.profile, 'profile'),
    collection: readJsonFile(resolvedRoot, files.collection, 'collection'),
    rendering: readJsonFile(resolvedRoot, files.rendering, 'rendering'),
    threeDThemes: readJsonFile(resolvedRoot, files.threeDThemes, '3D themes'),
  };

  const result = projectConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new ConfigError('Configuration validation failed.', formatZodIssues(result.error));
  }

  validateConfig(result.data, resolvedRoot);
  return deepFreeze(result.data);
}
