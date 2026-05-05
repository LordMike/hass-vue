import path from 'node:path';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import {
  DEFAULT_HA_CONFIG_ROOT,
  DEFAULT_SOURCE_ROOT,
  OUTPUT_ROOT_MARKER,
  OUTPUT_SUBDIR
} from './constants.mjs';

export async function validatePaths(logger, options = {}) {
  const sourceRoot = process.env.HA_VUE_SOURCE_ROOT || options.internal_source_root || DEFAULT_SOURCE_ROOT;
  const haConfigRoot = process.env.HA_VUE_HA_CONFIG_ROOT || DEFAULT_HA_CONFIG_ROOT;
  const outputRoot = process.env.HA_VUE_OUTPUT_ROOT || options.internal_output_root || path.join(haConfigRoot, OUTPUT_SUBDIR);
  const pagesRoot = path.join(sourceRoot, 'pages');
  const sharedRoot = path.join(sourceRoot, 'shared');
  const wwwRoot = path.join(haConfigRoot, 'www');

  await assertDirectory(haConfigRoot, 'Home Assistant config root');
  await mkdir(wwwRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(pagesRoot, { recursive: true });
  await mkdir(sharedRoot, { recursive: true });

  const realHaConfig = await realpath(haConfigRoot);
  const realWww = await realpath(wwwRoot);
  const resolvedOutput = path.resolve(outputRoot);
  const resolvedWww = path.resolve(realWww);
  const resolvedHaConfig = path.resolve(realHaConfig);

  if (!isPathInside(resolvedOutput, resolvedWww) && resolvedOutput !== path.join(resolvedWww, 'ha-vue')) {
    throw new Error(`Output root must resolve under ${resolvedWww}: ${resolvedOutput}`);
  }
  if (resolvedOutput === resolvedHaConfig || resolvedOutput === resolvedWww) {
    throw new Error(`Output root is too broad: ${resolvedOutput}`);
  }

  await mkdir(outputRoot, { recursive: true });
  const realOutput = await realpath(outputRoot);
  if (!isPathInside(realOutput, resolvedWww)) {
    throw new Error(`Output root escaped ${resolvedWww}: ${realOutput}`);
  }
  if (realOutput === resolvedHaConfig || realOutput === resolvedWww) {
    throw new Error(`Output root is too broad after resolution: ${realOutput}`);
  }
  const localOutputRoot = `/local/${path.relative(realWww, realOutput).split(path.sep).join('/')}`;

  await writeFile(path.join(realOutput, OUTPUT_ROOT_MARKER), 'managed by HA Vue Builder\n');
  await mkdir(path.join(realOutput, 'pages'), { recursive: true });
  await mkdir(path.join(realOutput, '.tmp'), { recursive: true });

  logger.info('paths ok', { source: pagesRoot, output: realOutput });
  return {
    appRoot: path.resolve(new URL('..', import.meta.url).pathname),
    sourceRoot: await realpath(sourceRoot),
    pagesRoot: await realpath(pagesRoot),
    sharedRoot: await realpath(sharedRoot),
    haConfigRoot: realHaConfig,
    wwwRoot: realWww,
    outputRoot: realOutput,
    localOutputRoot,
    outputPagesRoot: path.join(realOutput, 'pages'),
    tmpRoot: path.join(realOutput, '.tmp')
  };
}

export function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function assertDirectory(target, label) {
  let current;
  try {
    current = await stat(target);
  } catch {
    throw new Error(`Required ${label} does not exist: ${target}`);
  }
  if (!current.isDirectory()) throw new Error(`Required ${label} is not a directory: ${target}`);
}
