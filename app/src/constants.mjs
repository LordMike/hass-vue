import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ID = 'hass-vue';
export const APP_VERSION = process.env.HASS_VUE_VERSION || readPackageVersion() || 'local';

export const DEFAULT_SOURCE_ROOT = '/ha-config/hass-vue';
export const DEFAULT_HA_CONFIG_ROOT = '/ha-config';
export const OUTPUT_SUBDIR = 'www/hass-vue';

export const OUTPUT_ROOT_MARKER = '.hass-vue-output-root';
export const PAGE_OUTPUT_MARKER = '.hass-vue-page-output';
export const VALID_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function readPackageVersion() {
  try {
    const sourceDir = path.dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(path.join(sourceDir, '..', 'package.json'), 'utf8'));
    return packageJson.version;
  } catch {
    return null;
  }
}
