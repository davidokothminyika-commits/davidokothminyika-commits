/**
 * Prepare the settings document for the pinned 3D contribution graph action.
 *
 * The upstream action (`yoshi389111/github-profile-3d-contrib`) accepts a
 * settings array, one entry per rendered variant, plus the username, optional
 * repository cap and contribution year. Only documented settings fields are
 * forwarded so the action cannot be configured with undeclared inputs.
 */
export function createThreeDimensionalSettings({
  themes = [],
  username,
  maxRepositories = null,
  year = null,
} = {}) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new TypeError('themes must be a non-empty array');
  }
  if (typeof username !== 'string' || username.trim() === '') {
    throw new TypeError('username must be a non-empty GitHub login');
  }

  return themes.map((theme) => {
    const settings = {
      type: theme.type,
      fileName: theme.fileName,
      backgroundColor: theme.backgroundColor,
      foregroundColor: theme.foregroundColor,
      strongColor: theme.strongColor,
      weakColor: theme.weakColor,
      radarColor: theme.radarColor,
      growingAnimation: theme.growingAnimation ?? false,
      contribColors: [...theme.contribColors],
    };

    if (Number.isInteger(maxRepositories) && maxRepositories > 0) {
      settings.maxRepositories = maxRepositories;
    }
    if (Number.isInteger(year) && year > 0) {
      settings.year = year;
    }

    return settings;
  });
}
