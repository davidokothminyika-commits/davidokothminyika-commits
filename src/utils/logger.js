import { redactSecrets, redactString } from './redact.js';

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

const DEFAULT_SINK = (line) => {
  process.stderr.write(`${line}\n`);
};

/**
 * Minimal structured logger. Every record is redacted before it reaches the
 * sink, and caller-supplied context is never mutated.
 */
export function createLogger({ level = 'info', sink = DEFAULT_SINK, bindings = {} } = {}) {
  if (!(level in LEVELS)) {
    throw new Error(`Invalid log level: ${level}`);
  }

  const threshold = LEVELS[level];

  const emit = (recordLevel, message, context) => {
    if (LEVELS[recordLevel] < threshold) return;

    const record = {
      time: new Date().toISOString(),
      level: recordLevel,
      message: redactString(message),
    };

    const merged = { ...bindings, ...(context ?? {}) };
    if (Object.keys(merged).length > 0) {
      record.context = redactSecrets(merged);
    }

    sink(JSON.stringify(record));
  };

  return {
    level,
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (context) =>
      createLogger({
        level,
        sink,
        bindings: { ...bindings, ...context },
      }),
  };
}

export const silentLogger = Object.freeze({
  level: 'error',
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
});
