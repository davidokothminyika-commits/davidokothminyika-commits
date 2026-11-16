import { deepFreeze } from '../utils/freeze.js';

const DATE_CACHE = new Map();

const SOCIAL_GLYPHS = Object.freeze({
  github: '🐙',
  mail: '📧',
  linkedin: '💼',
  x: '✖️',
  globe: '🌐',
  code: '💻',
});

const FALLBACK_GLYPH = '🔗';

function dateFormatter(locale, timeZone) {
  const key = `${locale}|${timeZone}`;
  let formatter = DATE_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'full', timeStyle: 'long' });
    DATE_CACHE.set(key, formatter);
  }
  return formatter;
}

/**
 * Format the rendering timestamp label used by generated README content.
 * The formatter is cached per locale/time zone pair.
 */
export function formatTemplateDate({ locale, timeZone }, now = new Date()) {
  const formatter = dateFormatter(locale, timeZone);
  const formatted = formatter.format(now);
  return formatted;
}

function isSafeLink(url) {
  return typeof url === 'string' && (/^https:\/\//i.test(url) || /^mailto:/i.test(url));
}

function safeSocials(rawSocials) {
  if (!Array.isArray(rawSocials)) return [];

  return rawSocials
    .filter((social) => social && typeof social.label === 'string' && isSafeLink(social.url))
    .map((social) => ({
      ...social,
      glyph: SOCIAL_GLYPHS[social.icon] ?? FALLBACK_GLYPH,
    }));
}

function safeCurrentWork(raw) {
  const currentWork = raw && typeof raw === 'object' ? raw : {};
  return {
    projects: Array.isArray(currentWork.projects)
      ? currentWork.projects
          .filter((project) => project && typeof project.title === 'string')
          .map((project) => ({
            ...project,
            url: isSafeLink(project?.url) ? project.url : undefined,
          }))
      : [],
    focus: Array.isArray(currentWork.focus) ? [...currentWork.focus] : [],
    learning: Array.isArray(currentWork.learning) ? [...currentWork.learning] : [],
  };
}

function currentWorkSummary(currentWork) {
  return currentWork.projects.length + currentWork.focus.length + currentWork.learning.length > 0;
}

function summarizeLanguages(languages, limit = 8) {
  return (Array.isArray(languages) ? languages : [])
    .slice(0, limit)
    .map((language) => `${language.name} ${language.displayPercentage}%`)
    .join(', ');
}

function summarizeTechStack(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => `${group.group}: ${Array.isArray(group.items) ? group.items.join(', ') : ''}`)
    .join('; ');
}

/**
 * Build the public-safe Mustache context for the profile README.
 *
 * The context is assembled only from configuration and Phase 4/5 public views.
 * Private identifiers, private splits and raw activity payloads never enter the
 * template context.
 */
export function buildTemplateContext({ config, publicPayload, identity, now = new Date() } = {}) {
  const rendering = config?.rendering ?? {};
  const timestamp = rendering.timestamp ?? {};
  const assets = rendering.assets ?? {};
  const targets = Array.isArray(assets?.threeDimensional?.targets)
    ? assets.threeDimensional.targets
    : [];
  const findTarget = (variant) =>
    targets.find((target) => target?.variant === variant)?.target ?? null;
  const sections = rendering.sections ?? {};
  const statistics = publicPayload?.statistics ?? null;
  const languages = publicPayload?.languages ?? null;

  const languagesArray = Array.isArray(languages?.languages) ? [...languages.languages] : [];
  const technologyArray = Array.isArray(config?.profile?.technology)
    ? [...config.profile.technology]
    : [];
  const socials = safeSocials(config?.profile?.socials);
  const currentWork = safeCurrentWork(config?.profile?.currentWork);
  const footer = config?.profile?.footer ?? null;
  const hasCurrentWork = currentWorkSummary(currentWork);

  const context = {
    name: identity?.name ?? null,
    date: formatTemplateDate(timestamp, now),
    headline: config?.profile?.identity?.headline ?? null,
    location: config?.profile?.identity?.location ?? null,
    about: Array.isArray(config?.profile?.identity?.about)
      ? [...config.profile.identity.about]
      : [],
    socials,
    hasSocials: socials.length > 0,
    technology: technologyArray,
    hasTechStack: technologyArray.length > 0,
    techStackSummary: summarizeTechStack(technologyArray),
    languages: languagesArray,
    languageSummary: summarizeLanguages(languagesArray),
    statistics,
    featured: Array.isArray(publicPayload?.featured) ? [...publicPayload.featured] : [],
    activity: Array.isArray(statistics?.activity?.items) ? [...statistics.activity.items] : [],
    hasActivity: Array.isArray(statistics?.activity?.items) && statistics.activity.items.length > 0,
    activityComplete: statistics?.activity?.coverage?.complete === true,
    currentlyWorkingOn: currentWork,
    hasCurrentWork,
    footer,
    sections,
    assets: {
      banner: assets.banner ?? null,
      languageChart: assets.languageChart ?? null,
      techStack: assets.techStack ?? null,
      threeDimensional: findTarget('midnight'),
      threeDimensionalNight: findTarget('night'),
      threeDimensionalPurple: findTarget('purple'),
    },
  };

  return deepFreeze(context);
}
