const SECRET_KEY_PATTERN =
  /^(authorization|auth|token|access_?token|refresh_?token|id_?token|password|passwd|secret|client_?secret|api_?key|private_?key)$/i;
const SECRET_SUFFIX_PATTERN =
  /(?:^|_)(authorization|token|secret|password|passwd|api_?key|private_?key)$/i;
const SECRET_CAMEL_SUFFIX_PATTERN = /(?:Authorization|Token|Secret|Password|ApiKey|PrivateKey)$/;

function isSecretKey(key) {
  return (
    SECRET_KEY_PATTERN.test(key) ||
    SECRET_SUFFIX_PATTERN.test(key) ||
    SECRET_CAMEL_SUFFIX_PATTERN.test(key)
  );
}

const TOKEN_PATTERNS = [
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
];

const AUTHORIZATION_PATTERN =
  /("?authorization"?\s*[:=]\s*"?)(?:(?:token|bearer|basic)\s+)?[^",\s]+/gi;

/**
 * Remove known credential shapes from free-form text. Used for log messages
 * and API error text that may contain an upstream error string.
 */
export function redactString(value) {
  let result = String(value);
  for (const pattern of TOKEN_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result.replace(AUTHORIZATION_PATTERN, (_match, prefix) => `${prefix}[REDACTED]`);
}

/**
 * Recursively redact likely secrets from a log context or error object without
 * mutating the caller's value. Cycles become a marker instead of recursing.
 */
export function redactSecrets(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => redactSecrets(item, seen));
    }

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = isSecretKey(key) ? '[REDACTED]' : redactSecrets(child, seen);
    }
    return result;
  }

  return '[Unserializable]';
}
