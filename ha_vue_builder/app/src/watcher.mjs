import path from 'node:path';
import chokidar from 'chokidar';
import { discoverPages } from './discover-pages.mjs';
import { buildPage, removeOrphanOutputs } from './build-page.mjs';

export class PageWatcher {
  constructor(paths, options, logger, statusStore) {
    this.paths = paths;
    this.options = options;
    this.logger = logger;
    this.statusStore = statusStore;
    this.pagesBySlug = new Map();
    this.timers = new Map();
    this.debounceMs = 600;
  }

  async initialBuild() {
    const { pages } = await discoverPages(this.paths, this.options, this.logger);
    this.statusStore.syncDiscovered(pages);
    await this.statusStore.write(this.logger);
    this.pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
    await removeOrphanOutputs(pages, this.paths, this.logger);

    for (const page of pages) {
      this.logger.info('usage', {
        page: page.slug,
        resource: page.resourceUrl,
        card_type: page.cardType,
        panel_custom: page.panelName
      });
      const result = await buildPage(page, this.paths, this.logger, 'startup');
      this.statusStore.recordBuild(page, result);
      await this.statusStore.write(this.logger);
    }
  }

  start() {
    const watcher = chokidar.watch([
      this.paths.pagesRoot,
      this.paths.sharedRoot
    ], {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 },
      ignored: (filePath) => isIgnored(filePath)
    });

    watcher.on('all', (event, changedPath) => {
      this.queueFromPath(changedPath, event);
    });
    watcher.on('error', (error) => {
      this.logger.error('watcher error', { message: error.message });
    });
    this.logger.info('watcher started', { pages: this.paths.pagesRoot, shared: this.paths.sharedRoot });
    return watcher;
  }

  queueFromPath(changedPath, reason) {
    const relativeShared = path.relative(this.paths.sharedRoot, changedPath);
    if (relativeShared && !relativeShared.startsWith('..') && !path.isAbsolute(relativeShared)) {
      this.queueAll(`shared-${reason}`);
      return;
    }

    const relative = path.relative(this.paths.pagesRoot, changedPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return;
    const slug = relative.split(path.sep)[0];
    if (!slug) return;
    this.queueSlug(slug, reason);
  }

  queueAll(reason) {
    for (const slug of this.pagesBySlug.keys()) this.queueSlug(slug, reason);
  }

  queueSlug(slug, reason) {
    if (this.timers.has(slug)) clearTimeout(this.timers.get(slug));
    this.logger.info('build queued', { page: slug, reason });
    this.timers.set(slug, setTimeout(() => {
      this.timers.delete(slug);
      this.reconcile(slug, reason).catch((error) => {
        this.logger.error('reconcile failed', { page: slug, message: error.message });
      });
    }, this.debounceMs));
  }

  async reconcile(slug, reason) {
    const { pages } = await discoverPages(this.paths, this.options, this.logger);
    this.statusStore.syncDiscovered(pages);
    this.pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
    const removed = await removeOrphanOutputs(pages, this.paths, this.logger);
    for (const removedSlug of removed) this.statusStore.recordRemoval(removedSlug);

    const page = this.pagesBySlug.get(slug);
    if (page) {
      const result = await buildPage(page, this.paths, this.logger, reason);
      this.statusStore.recordBuild(page, result);
    }
    await this.statusStore.write(this.logger);
  }
}

function isIgnored(filePath) {
  const base = path.basename(filePath);
  return filePath.includes(`${path.sep}node_modules${path.sep}`)
    || filePath.includes(`${path.sep}.git${path.sep}`)
    || base.startsWith('.#')
    || base.endsWith('~')
    || base.endsWith('.swp')
    || base.endsWith('.tmp');
}
