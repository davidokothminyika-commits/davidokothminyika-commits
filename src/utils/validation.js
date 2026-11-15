/**
 * Format Zod issues into stable, human-readable lines.
 * Used by configuration and environment validation errors.
 */
export function formatZodIssues(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}
