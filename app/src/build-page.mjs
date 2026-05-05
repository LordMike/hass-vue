import path from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { PAGE_OUTPUT_MARKER } from './constants.mjs';

export async function buildPage(page, paths, logger, reason = 'manual') {
  const started = Date.now();
  const stamp = `${Date.now()}-${randomUUID()}`;
  const version = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const moduleFileName = `page.${version}.js`;
  const workRoot = path.join(paths.tmpRoot, `${page.slug}-${stamp}`);
  const entryDir = path.join(workRoot, 'entry');
  const outDir = path.join(workRoot, 'out');
  const entryFile = path.join(entryDir, 'main.js');

  logger.info('build started', { page: page.slug, reason });
  await mkdir(entryDir, { recursive: true });
  await writeFile(entryFile, entrySource(page));

  try {
    await build({
      root: entryDir,
      logLevel: 'silent',
      define: {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
      },
      plugins: [
        vue(),
        cssInjectedByJsPlugin({
          styleId: `hass-vue-page-${page.slug}`,
          injectCodeFunction: hassVueCssInject
        })
      ],
      resolve: {
        alias: {
          vue: path.join(paths.appRoot, 'node_modules/vue/dist/vue.runtime.esm-browser.prod.js'),
          '@hass-vue/hass': path.join(paths.appRoot, 'src/runtime/hass.ts'),
          '@hass-vue/create-page-element': path.join(paths.appRoot, 'src/runtime/createPageElement.ts')
        }
      },
      build: {
        outDir,
        emptyOutDir: true,
        cssCodeSplit: false,
        minify: true,
        sourcemap: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: () => moduleFileName,
          cssFileName: 'page'
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: 'assets/[name][extname]'
          }
        }
      }
    });

    await assertBuiltPage(outDir, moduleFileName);
    const manifest = {
      slug: page.slug,
      elementName: page.elementName,
      cardType: page.cardType,
      resourceUrl: page.resourceUrl,
      moduleFile: moduleFileName,
      moduleUrl: `./${moduleFileName}`,
      builtAt: new Date().toISOString(),
      version
    };
    await writeFile(path.join(outDir, 'page.js'), loaderSource(page, manifest));
    await writeFile(path.join(outDir, PAGE_OUTPUT_MARKER), `managed page output for ${page.slug}\n`);
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await publishPageOutput(page, outDir);
    const durationMs = Date.now() - started;
    logger.info('build ok', { page: page.slug, duration_ms: durationMs, url: page.resourceUrl });
    return {
      status: 'success',
      lastSuccessAt: new Date().toISOString(),
      durationMs,
      errorSummary: ''
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const diagnostic = summarizeBuildError(error);
    logger.error('build failed', { page: page.slug, duration_ms: durationMs });
    logger.error('build diagnostic', { page: page.slug, ...diagnostic });
    return {
      status: 'failed',
      lastFailedAt: new Date().toISOString(),
      durationMs,
      errorSummary: diagnostic.message
    };
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

export async function removePageOutput(page, logger) {
  if (!await hasPageMarker(page.outputDir)) {
    logger.info('output removal skipped no marker', { page: page.slug, output: page.outputDir });
    return false;
  }
  await rm(page.outputDir, { recursive: true, force: true });
  logger.info('output removed', { page: page.slug, output: page.outputDir });
  return true;
}

export async function removeOrphanOutputs(pages, paths, logger) {
  const { readdir } = await import('node:fs/promises');
  const sourceSlugs = new Set(pages.map((page) => page.slug));
  let entries = [];
  try {
    entries = await readdir(paths.outputPagesRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || sourceSlugs.has(entry.name)) continue;
    const page = {
      slug: entry.name,
      outputDir: path.join(paths.outputPagesRoot, entry.name)
    };
    if (await removePageOutput(page, logger)) removed.push(entry.name);
  }
  return removed;
}

function entrySource(page) {
  const componentPath = JSON.stringify(page.sourcePath);
  return `import Page from ${componentPath};
import { defineHassVuePageElement, mountHassVuePage as mountComponentPage } from '@hass-vue/create-page-element';

export const pageSlug = ${JSON.stringify(page.slug)};
export const elementName = ${JSON.stringify(page.elementName)};
export const cardType = ${JSON.stringify(page.cardType)};

export function mountHassVuePage(target, options = {}) {
  return mountComponentPage(Page, target, options);
}

export function unmountHassVuePage(mounted) {
  mounted?.unmount?.();
}

export function setHassVueHass(mounted, hass) {
  mounted?.updateHass?.(hass);
}

defineHassVuePageElement({
  elementName,
  component: Page
});
`;
}

function hassVueCssInject(cssCode, options = {}) {
  const id = options.styleId || 'hass-vue-page-style';
  const storeName = '__HASS_VUE_BUILDER_STYLES__';
  const globalTarget = globalThis;
  const existing = globalTarget[storeName] || [];
  if (!existing.some((entry) => entry.id === id && entry.css === cssCode)) {
    globalTarget[storeName] = [...existing, { id, css: cssCode }];
  }

  if (typeof document === 'undefined') return;
  const selector = `style[data-hass-vue-style="${id}"]`;
  if (document.head.querySelector(selector)) return;
  const style = document.createElement('style');
  style.setAttribute('data-hass-vue-style', id);
  style.appendChild(document.createTextNode(cssCode));
  document.head.appendChild(style);
}

function loaderSource(page, manifest) {
  return `const elementName = ${JSON.stringify(page.elementName)};
const fallbackModuleUrl = ${JSON.stringify(`./${manifest.moduleFile}`)};

let loadedModulePromise;

async function loadBuiltModule() {
  if (loadedModulePromise) return loadedModulePromise;
  loadedModulePromise = (async () => {
    let moduleUrl = fallbackModuleUrl;
    try {
      const manifestUrl = new URL('./manifest.json', import.meta.url);
      manifestUrl.searchParams.set('t', String(Date.now()));
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (response.ok) {
        const manifest = await response.json();
        if (manifest?.moduleUrl) moduleUrl = manifest.moduleUrl;
        else if (manifest?.moduleFile) moduleUrl = './' + manifest.moduleFile;
      }
    } catch (error) {
      console.warn('[hass-vue] manifest fetch failed, using fallback module', error);
    }
    return import(new URL(moduleUrl, import.meta.url).href);
  })();
  return loadedModulePromise;
}

class HassVueLoaderElement extends HTMLElement {
  #mounted = null;
  #target = null;
  #hass = null;
  #config = {};
  #mountOptions = readMountOptions();

  set hass(hass) {
    this.#hass = hass;
    this.#mounted?.updateHass?.(hass);
  }

  get hass() {
    return this.#hass;
  }

  setConfig(config) {
    this.#config = config || {};
  }

  getCardSize() {
    return 1;
  }

  connectedCallback() {
    if (this.#target) return;
    this.#target = document.createElement('div');
    this.#target.style.display = 'contents';
    this.appendChild(this.#target);
    loadBuiltModule().then((mod) => {
      if (!this.#target || this.#mounted) return;
      this.#mounted = mod.mountHassVuePage(this.#target, {
        hass: this.#hass,
        config: this.#config,
        ...this.#mountOptions
      });
    }).catch((error) => {
      console.error('[hass-vue] failed to load page module', error);
    });
  }

  disconnectedCallback() {
    this.#mounted?.unmount?.();
    this.#mounted = null;
    if (this.#target?.parentNode === this) this.removeChild(this.#target);
    this.#target = null;
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, HassVueLoaderElement);
}

export const pageSlug = ${JSON.stringify(page.slug)};
export { elementName };
export const cardType = ${JSON.stringify(page.cardType)};

export async function mountHassVuePage(target, options = {}) {
  const mod = await loadBuiltModule();
  return mod.mountHassVuePage(target, options);
}

export async function unmountHassVuePage(mounted) {
  return mounted?.unmount?.();
}

export async function setHassVueHass(mounted, hass) {
  return mounted?.updateHass?.(hass);
}

function readMountOptions() {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const snapshot = parseBoolean(params.get('hass-vue-snapshot') || params.get('snapshot'));
  const readyModeParam = params.get('hass-vue-ready') || params.get('ready');
  const readyMode = ['mounted', 'snapshot', 'manual'].includes(String(readyModeParam))
    ? readyModeParam
    : undefined;
  const readyTimeoutMs = Number(params.get('hass-vue-ready-timeout-ms') || params.get('readyTimeoutMs') || '');
  return {
    snapshot,
    readyMode,
    readyTimeoutMs: Number.isFinite(readyTimeoutMs) && readyTimeoutMs > 0 ? readyTimeoutMs : undefined
  };
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}
`;
}

async function assertBuiltPage(outDir, moduleFileName) {
  const pagePath = path.join(outDir, moduleFileName);
  const contents = await readFile(pagePath, 'utf8');
  if (!contents.trim()) throw new Error(`Vite produced an empty ${pagePath}`);
}

async function publishPageOutput(page, outDir) {
  const nextDir = `${page.outputDir}.next-${process.pid}-${Date.now()}`;
  const oldDir = `${page.outputDir}.old-${process.pid}-${Date.now()}`;
  await rm(nextDir, { recursive: true, force: true });
  await rename(outDir, nextDir);
  if (await directoryExists(page.outputDir) && !await hasPageMarker(page.outputDir)) {
    await rm(nextDir, { recursive: true, force: true });
    throw new Error(`Refusing to replace unmarked output directory: ${page.outputDir}`);
  }
  try {
    await rename(page.outputDir, oldDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rename(nextDir, page.outputDir);
  await rm(oldDir, { recursive: true, force: true });
}

async function hasPageMarker(outputDir) {
  try {
    await readFile(path.join(outputDir, PAGE_OUTPUT_MARKER), 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(outputDir) {
  try {
    const { stat } = await import('node:fs/promises');
    return (await stat(outputDir)).isDirectory();
  } catch {
    return false;
  }
}

function summarizeBuildError(error) {
  const loc = error.loc || error.location || {};
  const message = String(error.message || error).split('\n')[0].slice(0, 500);
  return {
    file: error.id || error.filename || loc.file,
    line: loc.line,
    column: loc.column,
    message
  };
}
