const LEVELS = { debug: 10, info: 20, error: 30 };

export function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function format(levelName, message, fields = {}) {
    const suffix = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${quoteValue(value)}`)
      .join(' ');
    return `[${levelName}] ${message}${suffix ? ` ${suffix}` : ''}`;
  }

  function emit(levelName, message, fields) {
    if ((LEVELS[levelName] ?? LEVELS.info) < threshold) return;
    const line = format(levelName, message, fields);
    if (levelName === 'error') console.error(line);
    else console.log(line);
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    error: (message, fields) => emit('error', message, fields)
  };
}

function quoteValue(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return JSON.stringify(text);
}
