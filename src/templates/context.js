import { deepFreeze } from '../utils/freeze.js';

const DATE_CACHE = new Map();

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

/**
 * Build the public-safe Mustache context for the profile README.
 *
 * The context is assembled only from configuration and Phase 4/5 public views.
 * Private identifiers, private splits and raw activity payloads never enter the
 * template context.
 */
export function buildTemplateContext({ config, publicPayload, identity, now = new Date() } = {}) {
  const timestamp = config?.rendering?.timestamp ?? {};
  const statistics = publicPayload?.statistics ?? null;
  const languages = publicPayload?.languages ?? null;

  const context = {
    name: identity?.name ?? null,
    date: formatTemplateDate(timestamp, now),
    headline: config?.profile?.identity?.headline ?? null,
    location: config?.profile?.identity?.location ?? null,
    about: Array.isArray(config?.profile?.identity?.about)
      ? [...config.profile.identity.about]
      : [],
    socials: Array.isArray(config?.profile?.socials) ? [...config.profile.socials] : [],
    technology: Array.isArray(config?.profile?.technology) ? [...config.profile.technology] : [],
    languages: Array.isArray(languages?.languages) ? [...languages.languages] : [],
    statistics,
    featured: Array.isArray(publicPayload?.featured) ? [...publicPayload.featured] : [],
    activity: Array.isArray(statistics?.activity?.items) ? [...statistics.activity.items] : [],
    activityComplete: statistics?.activity?.coverage?.complete === true,
  };

  return deepFreeze(context);
}
