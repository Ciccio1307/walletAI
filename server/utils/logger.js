const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN = LEVELS[process.env.LOG_LEVEL] ?? 1;
const ts = () => new Date().toISOString();

export const logger = {
  debug: (...a) => MIN <= 0 && console.log('[debug]', ts(), ...a),
  info:  (...a) => MIN <= 1 && console.log('[info]',  ts(), ...a),
  warn:  (...a) => MIN <= 2 && console.warn('[warn]',  ts(), ...a),
  error: (...a) => MIN <= 3 && console.error('[error]', ts(), ...a),
};
