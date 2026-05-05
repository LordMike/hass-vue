# HA Vue Builder Docs

## What It Does

HA Vue Builder turns Vue single-file components into standalone browser modules that can run as Home Assistant custom cards, `panel_custom` panels, or plain Vue apps mounted into arbitrary HTML. The static build output is written to `/config/www/ha-vue`, which Home Assistant serves as `/local/ha-vue`.

Failed builds do not replace the last successful output, so a syntax error in one page does not break working pages. The builder is intentionally page-agnostic: dashboards, tools, panels, status displays, and static or interactive HTML are all valid uses.

## Installation

Add this repository as a Home Assistant App repository, install **HA Vue Builder**, and start it. The app maps:

- Home Assistant config read/write as `/ha-config`

No npm commands are run at runtime. Dependencies are installed in the image with `npm ci --ignore-scripts --omit=dev`.

Source pages are stored in the Home Assistant config folder at `/config/ha-vue` from the user's point of view. Inside the HA Vue Builder app container, that same folder is mounted as `/ha-config/ha-vue`.

If you use the **Studio Code Server** app, open its Web UI and create or edit files under `/config/ha-vue`. Studio Code Server also runs as a Home Assistant app, but it exposes the Home Assistant config folder as `/config`, which is the path users normally see next to `configuration.yaml` and `www`.

The source and output roots are configurable:

| Option | Default | Notes |
| --- | --- | --- |
| `source_root` | `/config/ha-vue` | Contains `pages/` and `shared/`. Relative values are treated as folders under `/config`. |
| `output_root` | `/config/www/ha-vue` | Receives `status.html`, `status.json`, and built page modules. Keep this under `/config/www` so Home Assistant can serve it as `/local`. For example, `/config/www/custom-vue` is served as `/local/custom-vue`. |

Both paths must be under `/config`. `source_root` cannot be under `/config/www`, and the source and output roots cannot overlap.

## Folder Structure

```text
/config/ha-vue/
  pages/
    example/
      index.vue
      page.json
  shared/

/config/www/ha-vue/
  status.html
  status.json
  pages/
    example/
      page.js
      manifest.json
```

Inside the HA Vue Builder app container, the source tree above is `/ha-config/ha-vue` and the output tree is `/ha-config/www/ha-vue`.

Valid page slugs match `^[a-z0-9][a-z0-9-]*$`.

## Create A Page

Create:

```text
/config/ha-vue/pages/dashboard-entrance/index.vue
```

The generated element is:

```text
ha-vue-page-dashboard-entrance
```

The Lovelace card type is:

```text
custom:ha-vue-page-dashboard-entrance
```

The module URL is:

```text
/local/ha-vue/pages/dashboard-entrance/page.js
```

Optional metadata:

```json
{
  "title": "Entrance Dashboard",
  "description": "Main hallway Vue dashboard"
}
```

## Lovelace Resource And Card

Add the resource:

```yaml
resources:
  - url: /local/ha-vue/pages/dashboard-entrance/page.js
    type: module
```

Use the card:

```yaml
type: custom:ha-vue-page-dashboard-entrance
```

For a panel-mode view:

```yaml
views:
  - title: Entrance
    panel: true
    cards:
      - type: custom:ha-vue-page-dashboard-entrance
```

## panel_custom

```yaml
panel_custom:
  - name: ha-vue-page-dashboard-entrance  # Must exactly match the generated element name.
    sidebar_title: Entrance
    sidebar_icon: mdi:tablet-dashboard
    module_url: /local/ha-vue/pages/dashboard-entrance/page.js
    embed_iframe: false
    require_admin: false
```

## Vue Runtime

Pages can import Home Assistant helpers:

```vue
<script setup>
import { computed } from 'vue';
import { hassRef, getStateValue, getAttr, callService } from '@ha-vue/hass';

const entityCount = computed(() => Object.keys(hassRef.value?.states ?? {}).length);
const temperature = computed(() => getStateValue('sensor.living_room_temperature'));
</script>

<template>
  <main>
    <h1>{{ entityCount }} entities</h1>
    <p>{{ temperature }}</p>
  </main>
</template>
```

`hassRef` is a Vue `shallowRef`. The `hass` object appears only when Home Assistant instantiates the custom element and assigns its `hass` property. Opening the JavaScript file directly under `/local` does not provide `hass`.

## CSS

Vue SFC styles and imported CSS are bundled into the generated JavaScript with CSS injection. Users only add the JavaScript module as a Lovelace resource; no separate CSS resource is required.

## Screenshot Readiness

Every mounted page sets `data-ha-vue-ready="true"` and dispatches a bubbling `ha-vue-ready` event when the runtime considers it screenshot-safe. By default that means the Vue app has mounted and painted once.

For deterministic Home Assistant screenshots, add these query parameters to the page URL:

```text
?ha-vue-snapshot=1&ha-vue-ready=snapshot
```

Snapshot mode captures the first assigned `hass` object and renders from that snapshot. It does not wait for every entity to change and it does not keep moving as live updates arrive. Interactive pages should omit these parameters and use the default live `hass` behavior.

Automation can wait for:

```js
await page.waitForSelector('ha-vue-page-example[data-ha-vue-ready="true"]');
```

## Status Page

Open:

```text
/local/ha-vue/status.html
```

The status page lists source paths, output URLs, card types, panel names, build times, errors, and YAML examples. Machine-readable status is available at:

```text
/local/ha-vue/status.json
```

## Dev Server Option

`dev_server: true` exposes a small Ingress status/development endpoint on port `8099`. Static builds still run and remain authoritative under `/local/ha-vue`.

Vite HMR through Home Assistant Ingress is not guaranteed in every installation, so this app does not compromise the static output path to force HMR. Static mode requires a browser refresh after a rebuild.

## Build And Deletion Rules

Each page is built with an independent Vite build. A syntax error in one page does not prevent other pages from building.

Builds go to a temporary directory first. The app publishes a page only after `page.js` exists, then replaces the previous page directory. Failed builds keep the last-good output unchanged.

`page.js` is a stable loader. Each successful build also creates a versioned module such as `page.1760000000000-abcd1234.js` and updates `manifest.json`. The loader fetches `manifest.json` with `cache: no-store` and imports the versioned module, so Home Assistant configuration can keep using the stable `/local/ha-vue/pages/<slug>/page.js` URL while rebuilds get a fresh module URL after a browser refresh.

When a source page is deleted, the matching output directory is removed only if it contains `.ha-vue-page-output`. Orphan output folders without that marker are left alone.

## Security Model

Anyone who can edit `/config/ha-vue` can create frontend JavaScript that runs inside Home Assistant in the current logged-in user’s browser session. Treat page authors as trusted Home Assistant frontend code authors.

Do not put secrets, tokens, URLs containing credentials, or sensitive rendered data in page source or generated HTML. Content in `/config/www` is public to anyone who can reach the URL if they know it.

The app never embeds Home Assistant tokens, long-lived access tokens, credentials, or instance URLs. It uses only the `hass` object assigned by the Home Assistant frontend to the loaded custom element.

The watched `/config/ha-vue` tree is not treated as a Node project. A user-created `package.json` there is ignored; runtime does not run `npm install`, lifecycle scripts, yarn, or pnpm.

## Troubleshooting

- Check `/local/ha-vue/status.html` for the compact build error.
- Check Home Assistant App logs for `[error] build diagnostic`.
- Confirm the slug uses only lowercase letters, numbers, and hyphens.
- Confirm the Lovelace resource uses `type: module`.
- Refresh the browser after static builds.
- If a page renders without Home Assistant data, confirm it is loaded as a Lovelace card or `panel_custom`, not opened directly as a JS URL.
