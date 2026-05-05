import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { VALID_SLUG_RE } from './constants.mjs';
import { createExamplePage } from './example-page.mjs';

export async function discoverPages(paths, options, logger) {
  await ensureExampleIfNeeded(paths, options, logger);
  const entries = await readdir(paths.pagesRoot, { withFileTypes: true });
  const pages = [];
  const invalid = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const sourceDir = path.join(paths.pagesRoot, slug);
    const sourcePath = path.join(sourceDir, 'index.vue');
    if (!VALID_SLUG_RE.test(slug)) {
      invalid.push(slug);
      logger.error('page skipped invalid slug', { slug, source: sourceDir });
      continue;
    }
    try {
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) continue;
    } catch {
      continue;
    }

    const meta = await readPageMeta(sourceDir, slug);
    const elementName = `hass-vue-page-${slug}`;
    const page = {
      slug,
      title: meta.title,
      description: meta.description ?? '',
      sourceDir,
      sourcePath,
      outputDir: path.join(paths.outputPagesRoot, slug),
      outputPath: path.join(paths.outputPagesRoot, slug, 'page.js'),
      resourceUrl: `${paths.localOutputRoot}/pages/${slug}/page.js`,
      cardType: `custom:${elementName}`,
      panelName: elementName,
      elementName
    };
    pages.push(page);
    logger.info('page discovered', { slug, source: sourcePath });
  }

  const seenElements = new Set();
  for (const page of pages) {
    if (seenElements.has(page.elementName)) {
      throw new Error(`Duplicate generated custom element name: ${page.elementName}`);
    }
    seenElements.add(page.elementName);
  }

  return { pages, invalid };
}

export function titleFromSlug(slug) {
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

async function ensureExampleIfNeeded(paths, options, logger) {
  const entries = await readdir(paths.pagesRoot, { withFileTypes: true });
  const hasAnyPage = entries.some((entry) => entry.isDirectory());
  if (!hasAnyPage && options.create_example) {
    await createExamplePage(paths, logger);
  }
}

async function readPageMeta(sourceDir, slug) {
  try {
    const parsed = JSON.parse(await readFile(path.join(sourceDir, 'page.json'), 'utf8'));
    return {
      title: String(parsed.title || titleFromSlug(slug)),
      description: parsed.description ? String(parsed.description) : ''
    };
  } catch {
    return { title: titleFromSlug(slug), description: '' };
  }
}
