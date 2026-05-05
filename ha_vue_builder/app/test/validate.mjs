import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createLogger } from '../src/logger.mjs';
import { validatePaths } from '../src/paths.mjs';
import { discoverPages } from '../src/discover-pages.mjs';
import { buildPage, removePageOutput } from '../src/build-page.mjs';
import { StatusStore } from '../src/status.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'ha-vue-builder-'));
const shareRoot = path.join(root, 'share');
const haConfigRoot = path.join(root, 'ha-config');
await mkdir(shareRoot, { recursive: true });
await mkdir(path.join(haConfigRoot, 'www'), { recursive: true });

process.env.HA_VUE_SHARE_ROOT = shareRoot;
process.env.HA_VUE_SOURCE_ROOT = path.join(shareRoot, 'ha-vue');
process.env.HA_VUE_HA_CONFIG_ROOT = haConfigRoot;

const logger = createLogger('info');
try {
  const paths = await validatePaths(logger);
  const options = { create_example: false, dev_server: false, log_level: 'info' };
  const exampleDiscovery = await discoverPages(paths, { ...options, create_example: true }, logger);
  assert.equal(exampleDiscovery.pages.length, 1);
  assert.equal(exampleDiscovery.pages[0].slug, 'example');
  await readFile(path.join(paths.pagesRoot, 'example', 'index.vue'), 'utf8');
  await rm(path.join(paths.pagesRoot, 'example'), { recursive: true, force: true });

  const pageDir = path.join(paths.pagesRoot, 'test-page');
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, 'index.vue'), `<template><main class="ok">First</main></template><style>.ok{font-weight:700}</style>`);

  let { pages } = await discoverPages(paths, options, logger);
  assert.equal(pages.length, 1);
  const page = pages[0];
  const status = new StatusStore(paths, options);
  status.syncDiscovered(pages);

  const first = await buildPage(page, paths, logger, 'test-initial');
  status.recordBuild(page, first);
  assert.equal(first.status, 'success');
  let pageModule = await readFile(page.outputPath, 'utf8');
  assert.match(pageModule, /customElements/);
  assert.match(pageModule, /manifest\.json/);
  assert.doesNotMatch(pageModule, /process\.env/);
  assert.match(pageModule, /mountHaVuePage/);
  assert.match(pageModule, /unmountHaVuePage/);
  const manifest = JSON.parse(await readFile(path.join(page.outputDir, 'manifest.json'), 'utf8'));
  assert.match(manifest.moduleFile, /^page\..+\.js$/);
  const versionedModule = await readFile(path.join(page.outputDir, manifest.moduleFile), 'utf8');
  assert.match(versionedModule, /First/);
  assert.match(versionedModule, /font-weight/);
  await readFile(path.join(page.outputDir, '.ha-vue-page-output'), 'utf8');

  await writeFile(path.join(pageDir, 'index.vue'), `<template><main>Second</main></template>`);
  const second = await buildPage(page, paths, logger, 'test-modify');
  assert.equal(second.status, 'success');
  pageModule = await readFile(page.outputPath, 'utf8');
  const secondManifest = JSON.parse(await readFile(path.join(page.outputDir, 'manifest.json'), 'utf8'));
  assert.notEqual(secondManifest.moduleFile, manifest.moduleFile);
  const secondVersionedModule = await readFile(path.join(page.outputDir, secondManifest.moduleFile), 'utf8');
  assert.match(secondVersionedModule, /Second/);
  const filesAfterSecondBuild = await readdir(page.outputDir);
  assert.equal(filesAfterSecondBuild.filter((name) => /^page\..+\.js$/.test(name)).length, 1);

  await writeFile(path.join(pageDir, 'index.vue'), `<template><main><span></main></template>`);
  const failed = await buildPage(page, paths, logger, 'test-failure');
  assert.equal(failed.status, 'failed');
  pageModule = await readFile(page.outputPath, 'utf8');
  assert.match(pageModule, /manifest\.json/);
  const stillGoodManifest = JSON.parse(await readFile(path.join(page.outputDir, 'manifest.json'), 'utf8'));
  assert.equal(stillGoodManifest.moduleFile, secondManifest.moduleFile);

  await rm(path.join(page.outputDir, '.ha-vue-page-output'));
  const skipped = await removePageOutput(page, logger);
  assert.equal(skipped, false);
  pageModule = await readFile(page.outputPath, 'utf8');
  const markerSkippedManifest = JSON.parse(await readFile(path.join(page.outputDir, 'manifest.json'), 'utf8'));
  assert.equal(markerSkippedManifest.moduleFile, secondManifest.moduleFile);
  await writeFile(path.join(pageDir, 'index.vue'), `<template><main>Third</main></template>`);
  const unmarkedReplace = await buildPage(page, paths, logger, 'test-unmarked-replace');
  assert.equal(unmarkedReplace.status, 'failed');
  pageModule = await readFile(page.outputPath, 'utf8');
  const unmarkedReplaceManifest = JSON.parse(await readFile(path.join(page.outputDir, 'manifest.json'), 'utf8'));
  assert.equal(unmarkedReplaceManifest.moduleFile, secondManifest.moduleFile);

  await writeFile(path.join(page.outputDir, '.ha-vue-page-output'), 'managed\n');
  const removed = await removePageOutput(page, logger);
  assert.equal(removed, true);
  await assert.rejects(readFile(page.outputPath, 'utf8'));

  await status.write(logger);
  await readFile(path.join(paths.outputRoot, 'status.html'), 'utf8');
  await readFile(path.join(paths.outputRoot, 'status.json'), 'utf8');

  console.log(`[info] validation ok root=${root}`);
} finally {
  await rm(root, { recursive: true, force: true });
}
