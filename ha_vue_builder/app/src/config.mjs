import { readFile } from 'node:fs/promises';

const DEFAULT_OPTIONS = {
  dev_server: false,
  log_level: 'info',
  create_example: true
};

export async function loadConfig(optionsPath = process.env.HA_VUE_OPTIONS_PATH || '/data/options.json') {
  let raw = {};
  try {
    raw = JSON.parse(await readFile(optionsPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const config = { ...DEFAULT_OPTIONS, ...raw };
  config.dev_server = Boolean(config.dev_server);
  config.create_example = config.create_example !== false;
  if (!['info', 'debug'].includes(config.log_level)) config.log_level = 'info';
  return config;
}
