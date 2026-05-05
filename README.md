# HA Vue Builder

![Project status](https://img.shields.io/badge/status-experimental-orange)
![Build](https://github.com/LordMike/hass-vue/actions/workflows/build.yml/badge.svg?branch=master)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-add--on-41bdf5)
![License](https://img.shields.io/badge/license-MIT-blue)

HA Vue Builder is a Home Assistant add-on repository for building Vue single-file components into standalone browser modules. It is for Home Assistant users who want richer custom dashboards, sidebar panels, status displays, or frontend tools without maintaining a separate frontend deployment.

Each page lives under `/share/ha-vue/pages`, builds independently with Vue and Vite, and is published to `/config/www/ha-vue` for Home Assistant to serve as `/local/ha-vue`. The same generated module can be used as a Lovelace custom card, a `panel_custom` page, or a plain browser-mounted Vue app.

Failed builds keep the last successful output in place, and the add-on writes a status page with generated YAML examples for every discovered page.

## Quickstart

- Add this repository to Home Assistant as an add-on repository: `https://github.com/LordMike/hass-vue`
- Install and start **HA Vue Builder**.
- Open `/local/ha-vue/status.html` after the first build, then edit `/share/ha-vue/pages/example/index.vue`.

## Features

- Vue SFC pages compiled with Vite
- One independent output module per page folder
- Lovelace card, `panel_custom`, and plain browser module support
- Stable `/local/ha-vue/pages/<slug>/page.js` URLs with cache-busting versioned modules
- Last-good output preserved when a build fails
- Status HTML/JSON with generated YAML snippets
- Screenshot readiness events and snapshot mode for deterministic captures

## Documentation

- [Add-on README](ha_vue_builder/README.md) — compact install and first-use notes.
- [Full docs](ha_vue_builder/DOCS.md) — page layout, Lovelace resources, `panel_custom`, runtime helpers, status output, security notes, and troubleshooting.
- [Changelog](ha_vue_builder/CHANGELOG.md) — release notes.

## Usage

Create a page:

```text
/share/ha-vue/pages/dashboard/index.vue
```

The add-on builds it to:

```text
/config/www/ha-vue/pages/dashboard/page.js
/local/ha-vue/pages/dashboard/page.js
```

Add the generated module as a Lovelace resource:

```yaml
resources:
  - url: /local/ha-vue/pages/dashboard/page.js
    type: module
```

Use the generated card type:

```yaml
type: custom:ha-vue-page-dashboard
```

The same page can be mounted as a Home Assistant sidebar panel with `panel_custom`:

```yaml
panel_custom:
  - name: ha-vue-page-dashboard
    sidebar_title: Dashboard
    sidebar_icon: mdi:tablet-dashboard
    module_url: /local/ha-vue/pages/dashboard/page.js
    embed_iframe: false
    require_admin: false
```

## Default Page

When `create_example` is enabled and no pages exist, the add-on creates:

```text
/share/ha-vue/pages/example/index.vue
/share/ha-vue/pages/example/page.json
```

The bundled example page is a Home Assistant-aware Vue dashboard. It shows connection status, live time, entity count, unavailable entity count, `sun.sun`, largest domains, recently updated entities, and a small update log. It uses the runtime helpers from `@ha-vue/hass`, including `hassRef`, `hassSnapshotRef`, and snapshot state reads.

Edit that page, wait for a successful rebuild in the add-on log or status page, then refresh the Home Assistant page that loads the module.

## Configuration

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `dev_server` | no | `false` | Exposes the status/development endpoint through Home Assistant Ingress on port `8099`. Static `/local` output remains authoritative. |
| `log_level` | no | `info` | Use `debug` while diagnosing watcher or build behavior. |
| `create_example` | no | `true` | Creates the bundled example page when `/share/ha-vue/pages` has no page folders. |

## Deployment

This repository is laid out as a Home Assistant add-on repository:

```text
repository.yaml
ha_vue_builder/
  config.yaml
  Dockerfile
  run.sh
  app/
```

Home Assistant installs use the published multi-arch Docker image declared in `ha_vue_builder/config.yaml`:

```text
ghcr.io/lordmike/hass-vue
```

The add-on image installs Node dependencies at image build time with:

```bash
npm ci --ignore-scripts --omit=dev
```

At runtime it watches `/share/ha-vue/pages` and `/share/ha-vue/shared`, builds pages into `/ha-config/www/ha-vue`, and serves them through Home Assistant as `/local/ha-vue`.

Version tags must use plain numeric semantic versions such as `0.2.5`. The release workflow intentionally rejects the usual `v0.2.5` prefix because Home Assistant add-on versions require the unprefixed form.

Tagged releases publish Docker images to GitHub Container Registry:

```text
ghcr.io/lordmike/hass-vue:<a.b.c>
ghcr.io/lordmike/hass-vue:latest
```

## Development

Run the validation script from the app folder:

```bash
cd ha_vue_builder/app
npm ci
npm run validate
```

The validation creates temporary Home Assistant-like folders, verifies example creation, builds a test Vue page, checks stable loader output, confirms failed builds keep the last-good module, and validates marker-gated deletion.

## Security

Anyone who can edit `/share/ha-vue` can create JavaScript that runs inside the Home Assistant frontend for the logged-in browser session. Treat page authors as trusted Home Assistant frontend code authors.

Do not put secrets, tokens, credentialed URLs, or sensitive rendered data in page source or generated output. Home Assistant serves `/config/www` content publicly under `/local` to anyone who can reach the URL.

## Status

I make open source software in my free time and share it so others can use it, learn from it, or build on it. The project is provided as-is with no guarantees about quality, correctness, or support. Issues and pull requests are welcome, but there is no guarantee of response time, fixes, or ongoing maintenance.

[Project license](LICENSE.txt).
