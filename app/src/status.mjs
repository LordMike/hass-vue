import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { APP_VERSION } from './constants.mjs';

export class StatusStore {
  constructor(paths, options) {
    this.paths = paths;
    this.options = options;
    this.pages = new Map();
    this.generatedAt = new Date().toISOString();
  }

  syncDiscovered(pages) {
    const current = new Set(pages.map((page) => page.slug));
    for (const page of pages) {
      const previous = this.pages.get(page.slug) || {};
      this.pages.set(page.slug, {
        ...previous,
        ...page,
        buildStatus: previous.buildStatus || 'pending',
        lastSuccessAt: previous.lastSuccessAt || null,
        lastFailedAt: previous.lastFailedAt || null,
        durationMs: previous.durationMs ?? null,
        errorSummary: previous.errorSummary || ''
      });
    }
    for (const slug of this.pages.keys()) {
      if (!current.has(slug)) this.pages.delete(slug);
    }
  }

  recordBuild(page, result) {
    const previous = this.pages.get(page.slug) || page;
    this.pages.set(page.slug, {
      ...previous,
      ...page,
      buildStatus: result.status,
      lastSuccessAt: result.lastSuccessAt || previous.lastSuccessAt || null,
      lastFailedAt: result.lastFailedAt || previous.lastFailedAt || null,
      durationMs: result.durationMs,
      errorSummary: result.errorSummary || ''
    });
  }

  recordRemoval(slug) {
    this.pages.delete(slug);
  }

  async write(logger) {
    this.generatedAt = new Date().toISOString();
    const json = this.toJson();
    const jsonPath = path.join(this.paths.outputRoot, 'status.json');
    const htmlPath = path.join(this.paths.outputRoot, 'status.html');
    await writeFile(jsonPath, JSON.stringify(json, null, 2));
    await writeFile(htmlPath, renderHtml(json));
    logger.info('status written', {
      html: `${this.paths.localOutputRoot}/status.html`,
      json: `${this.paths.localOutputRoot}/status.json`
    });
  }

  toJson() {
    return {
      app: {
        name: 'hass-vue',
        version: APP_VERSION
      },
      sourceRoot: this.paths.sourceRoot,
      outputRoot: this.paths.outputRoot,
      localOutputRoot: this.paths.localOutputRoot,
      generatedAt: this.generatedAt,
      devServer: {
        enabled: Boolean(this.options.dev_server),
        ingress: this.options.dev_server
          ? 'Ingress exposes this status/dev endpoint. Static /local output remains authoritative.'
          : 'Disabled'
      },
      pages: [...this.pages.values()].sort((a, b) => a.slug.localeCompare(b.slug)).map((page) => ({
        slug: page.slug,
        title: page.title,
        description: page.description,
        sourcePath: page.sourcePath,
        outputPath: page.outputPath,
        resourceUrl: page.resourceUrl,
        manifestUrl: `${this.paths.localOutputRoot}/pages/${page.slug}/manifest.json`,
        cardType: page.cardType,
        panelCustomName: page.panelName,
        buildStatus: page.buildStatus,
        lastBuildTime: page.lastSuccessAt || page.lastFailedAt || null,
        lastSuccessfulBuildTime: page.lastSuccessAt,
        lastFailedBuildTime: page.lastFailedAt,
        buildDurationMs: page.durationMs,
        errorSummary: page.errorSummary,
        lovelaceYaml: `views:\n  - title: ${page.title}\n    panel: true # Make this full screen.\n    cards:\n      - type: ${page.cardType}`,
        panelCustomYaml: `panel_custom:\n  - name: ${page.panelName}  # Must exactly match the generated element name.\n    sidebar_title: ${page.title}\n    sidebar_icon: mdi:tablet-dashboard\n    module_url: ${page.resourceUrl}\n    embed_iframe: false\n    require_admin: false`,
        browserModuleExample: `<div id="hass-vue-root"></div>\n<script type="module">\n  import { mountHassVuePage } from '${page.resourceUrl}';\n\n  const mounted = mountHassVuePage(document.getElementById('hass-vue-root'));\n\n  // Optional outside Home Assistant:\n  // mounted.updateHass(fakeOrRealHassObject);\n  // mounted.unmount();\n</script>`
      }))
    };
  }
}

export function renderHtml(status) {
  const pageRows = status.pages.map((page) => `
    <article id="page-${escapeAttr(page.slug)}">
      <h2>${escapeHtml(page.title)} <code>${escapeHtml(page.slug)}</code></h2>
      ${page.description ? `<p>${escapeHtml(page.description)}</p>` : ''}
      <dl>
        <dt>Status</dt><dd class="${page.buildStatus === 'failed' ? 'failed' : 'ok'}">${escapeHtml(page.buildStatus)}</dd>
        <dt>Source</dt><dd><code>${escapeHtml(page.sourcePath)}</code></dd>
        <dt>Output</dt><dd><code>${escapeHtml(page.outputPath)}</code></dd>
        <dt>Module link</dt><dd><a href="${escapeAttr(page.resourceUrl)}"><code>${escapeHtml(page.resourceUrl)}</code></a></dd>
        <dt>Manifest</dt><dd><a href="${escapeAttr(page.manifestUrl)}"><code>${escapeHtml(page.manifestUrl)}</code></a></dd>
        <dt>Card type</dt><dd><code>${escapeHtml(page.cardType)}</code></dd>
        <dt>Panel name</dt><dd><code>${escapeHtml(page.panelCustomName)}</code></dd>
        <dt>Last built</dt><dd>${escapeHtml(page.lastBuildTime || 'never')}</dd>
        <dt>Last success</dt><dd>${escapeHtml(page.lastSuccessfulBuildTime || 'never')}</dd>
        <dt>Last failure</dt><dd>${escapeHtml(page.lastFailedBuildTime || 'never')}</dd>
        <dt>Duration</dt><dd>${page.buildDurationMs ?? 'n/a'} ms</dd>
        <dt>Error</dt><dd>${escapeHtml(page.errorSummary || '')}</dd>
      </dl>
      <h3>Preferred: Lovelace card</h3>
      <p>Add <code>${escapeHtml(page.resourceUrl)}</code> as a JavaScript module resource in Home Assistant's dashboard resource UI, then add this card to a dashboard view. The example uses Lovelace panel mode so the card fills the view.</p>
      <pre>${escapeHtml(page.lovelaceYaml)}</pre>
      <h3>Home Assistant configuration.yaml panel_custom</h3>
      <p>Add this block to Home Assistant <code>configuration.yaml</code>, then restart Home Assistant Core.</p>
      <pre>${escapeHtml(page.panelCustomYaml)}</pre>
      <h3>Plain browser module</h3>
      <pre>${escapeHtml(page.browserModuleExample)}</pre>
    </article>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="cache-control" content="no-store">
  <meta http-equiv="pragma" content="no-cache">
  <title>hass-vue Status</title>
  <style>
    body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; color: #111; background: #fff; }
    main { max-width: 1100px; margin: 0 auto; }
    header, article { border-bottom: 1px solid #bbb; padding: 0 0 20px; margin-bottom: 20px; }
    section { border-bottom: 1px solid #bbb; padding: 0 0 20px; margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0 0 16px; font-size: 22px; }
    h3 { margin: 18px 0 8px; font-size: 17px; }
    dl { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 8px 16px; }
    dt { font-weight: 700; }
    dd { margin: 0; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    code, pre { background: #f3f3f3; border: 1px solid #ddd; }
    code { padding: 1px 4px; }
    pre { padding: 12px; overflow: auto; }
    .ok { color: #12621f; font-weight: 700; }
    .failed { color: #9a1111; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>hass-vue Status</h1>
      <p>Version ${escapeHtml(status.app.version)}. Generated ${escapeHtml(status.generatedAt)}.</p>
      <p>Source <code>${escapeHtml(status.sourceRoot)}</code></p>
      <p>Output <code>${escapeHtml(status.outputRoot)}</code></p>
      <p>Status JSON <a href="${escapeAttr(status.localOutputRoot)}/status.json"><code>${escapeHtml(status.localOutputRoot)}/status.json</code></a></p>
      <p>Dev server: ${escapeHtml(status.devServer.ingress)}</p>
    </header>
    <section>
      <h2>How To Use A Built Page</h2>
      <p>Each page builds to one browser JavaScript module. Use it as a Lovelace card, a Home Assistant <code>panel_custom</code>, or a plain module mounted into any web page.</p>
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Where config goes</th>
            <th>What you get</th>
            <th>Tradeoffs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lovelace card</td>
            <td>Home Assistant dashboard resource UI, then dashboard card YAML/UI. Add the module URL as a JavaScript module resource under <code>Settings &gt; Dashboards</code>, then use the listed <code>custom:...</code> card type.</td>
            <td>A dashboard card. Use <code>panel: true</code> on the view when the page should fill the view content area.</td>
            <td>Preferred setup. Easiest to try and edit from the dashboard UI. It still lives inside a Lovelace dashboard and follows Lovelace routing.</td>
          </tr>
          <tr>
            <td><code>panel_custom</code></td>
            <td>Home Assistant <code>configuration.yaml</code>, not Lovelace dashboard YAML. Add the listed <code>panel_custom:</code> block and restart Home Assistant Core.</td>
            <td>A sidebar panel whose content is your Vue page custom element loaded from <code>module_url</code>.</td>
            <td>Best when the page should feel like its own HA section. Requires a Core restart when adding/removing/changing the panel config. Vue source edits still only need rebuild plus browser refresh.</td>
          </tr>
          <tr>
            <td>Plain browser module</td>
            <td>Any HTML page that can load the built JavaScript module. Import <code>mountHassVuePage</code> from the module and call it with a target element.</td>
            <td>A normal Vue app mounted into your chosen div. The same module still registers the Home Assistant custom element.</td>
            <td>Outside Home Assistant there is no real <code>hass</code> object unless you provide one. Helpers such as <code>getState</code> return empty values until <code>mounted.updateHass(...)</code> is called.</td>
          </tr>
          <tr>
            <td>Screenshot mode</td>
            <td>Add <code>?hass-vue-snapshot=1&amp;hass-vue-ready=snapshot</code> to the HA page URL, then wait for <code>data-hass-vue-ready="true"</code> or the <code>hass-vue-ready</code> event.</td>
            <td>The first assigned Home Assistant <code>hass</code> object is captured as a snapshot and rendered. Later live updates do not move the page.</td>
            <td>Best for deterministic screenshots. Interactive dashboards should omit these URL parameters and use the default live mode.</td>
          </tr>
        </tbody>
      </table>
      <p><code>panel_custom</code> belongs in Home Assistant <code>configuration.yaml</code>. Use <code>embed_iframe: false</code> so Home Assistant loads the module as a frontend custom element and assigns the <code>hass</code> object.</p>
      <p><code>page.js</code> is a stable loader. It reads <code>manifest.json</code> without cache and imports the latest versioned module file. Static mode does not live-reload the browser; after a successful rebuild, refresh the HA page that uses the module.</p>
      <p>For automation, wait for <code>data-hass-vue-ready="true"</code> on the custom element or listen for <code>hass-vue-ready</code>. The default readiness means mounted and painted. Snapshot readiness is opt-in with <code>hass-vue-snapshot=1</code>.</p>
    </section>
    <section>
      <h2>Screenshot Readiness</h2>
      <p>DOM loaded is too early for screenshots. hass-vue exposes an explicit readiness signal from the mounted page.</p>
      <table>
        <thead>
          <tr>
            <th>Need</th>
            <th>Use</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Interactive page</td>
            <td>No extra URL parameters</td>
            <td>The page receives live Home Assistant <code>hass</code> updates. Readiness is marked after the Vue app mounts and paints once.</td>
          </tr>
          <tr>
            <td>Deterministic screenshot</td>
            <td><code>?hass-vue-snapshot=1&amp;hass-vue-ready=snapshot</code></td>
            <td>The first assigned <code>hass</code> object is captured as a snapshot. Later live updates do not move the page.</td>
          </tr>
          <tr>
            <td>Manual readiness</td>
            <td><code>?hass-vue-ready=manual</code> plus <code>markReady()</code> in page code</td>
            <td>Your Vue page decides when it is ready, for example after fonts, images, charts, or service data have settled.</td>
          </tr>
        </tbody>
      </table>
      <h3>Wait Targets</h3>
      <pre>${escapeHtml(`// Custom element in Home Assistant:
await page.waitForSelector('hass-vue-page-example[data-hass-vue-ready="true"]');

// Any mounted target:
await page.waitForSelector('[data-hass-vue-ready="true"]');

// Event form:
await page.evaluate(() => new Promise((resolve) => {
  window.addEventListener('hass-vue-ready', resolve, { once: true });
}));`)}</pre>
      <h3>Page API</h3>
      <pre>${escapeHtml(`import {
  hassRef,
  hassSnapshotRef,
  markBusy,
  markReady
} from '@hass-vue/hass';

// Optional manual readiness:
markBusy({ reason: 'loading-chart' });
// render/fetch/load images...
markReady({ reason: 'chart-rendered' });`)}</pre>
    </section>
    <section class="summary">
      <h2>Built Pages</h2>
      <ul>
        ${status.pages.map((page) => `<li><a href="#page-${escapeAttr(page.slug)}">${escapeHtml(page.title)}</a> <code>${escapeHtml(page.cardType)}</code> <span class="${page.buildStatus === 'failed' ? 'failed' : 'ok'}">${escapeHtml(page.buildStatus)}</span> <span>${escapeHtml(page.lastBuildTime || 'never')}</span></li>`).join('\n') || '<li>No pages discovered.</li>'}
      </ul>
    </section>
    ${pageRows || '<p>No pages discovered.</p>'}
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
