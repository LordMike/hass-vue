import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { DEFAULT_HA_CONFIG_ROOT, DEFAULT_SOURCE_ROOT, OUTPUT_SUBDIR } from './constants.mjs';

const DEFAULT_OPTIONS = {
  dev_server: false,
  log_level: 'info',
  create_example: true,
  source_root: '/config/ha-vue',
  output_root: '/config/www/ha-vue'
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
  config.source_root = normalizeUserConfigPath(config.source_root, DEFAULT_OPTIONS.source_root, 'source_root');
  config.output_root = normalizeUserConfigPath(config.output_root, DEFAULT_OPTIONS.output_root, 'output_root');
  validateConfiguredRoots(config.source_root, config.output_root);
  const internalConfigRoot = process.env.HA_VUE_HA_CONFIG_ROOT || DEFAULT_HA_CONFIG_ROOT;
  config.internal_source_root = toInternalConfigPath(config.source_root, DEFAULT_SOURCE_ROOT, internalConfigRoot);
  config.internal_output_root = toInternalConfigPath(config.output_root, path.join(internalConfigRoot, OUTPUT_SUBDIR), internalConfigRoot);
  return config;
}

function normalizeUserConfigPath(value, fallback, name) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const prefixed = raw.startsWith('/') ? raw : `/config/${raw}`;
  const normalized = path.posix.normalize(prefixed);
  if (normalized === '/config' || !normalized.startsWith('/config/')) {
    throw new Error(`${name} must be under /config, got ${raw}`);
  }
  return normalized;
}

function validateConfiguredRoots(sourceRoot, outputRoot) {
  if (sourceRoot === '/config/www' || sourceRoot.startsWith('/config/www/')) {
    throw new Error('source_root must not be under /config/www because Home Assistant serves that folder publicly as /local');
  }
  if (sourceRoot === outputRoot || sourceRoot.startsWith(`${outputRoot}/`) || outputRoot.startsWith(`${sourceRoot}/`)) {
    throw new Error('source_root and output_root must not overlap');
  }
}

function toInternalConfigPath(userPath, fallback, internalConfigRoot) {
  if (!userPath.startsWith('/config/')) return fallback;
  return path.posix.join(internalConfigRoot, userPath.slice('/config/'.length));
}
