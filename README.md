# hass-vue

![Project status](https://img.shields.io/badge/status-experimental-orange)
![Build](https://github.com/LordMike/hass-vue/actions/workflows/build.yml/badge.svg?branch=master)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-add--on-41bdf5)
![License](https://img.shields.io/badge/license-MIT-blue)

hass-vue builds Vue single-file components into standalone browser modules for Home Assistant. It is for Home Assistant users who want to create completely custom views while still receiving the frontend `hass` object, including all entity states and live updates.

That makes it useful for views where Lovelace is too constrained, such as a black-and-white e-paper dashboard where every pixel, layout rule, and rendered state needs to be controlled directly. Each page lives under `/config/hass-vue/pages`, builds independently with Vue and Vite, and is published to `/config/www/hass-vue` for Home Assistant to serve as `/local/hass-vue`.

The generated module can be used as a Lovelace custom card, a `panel_custom` page, or a plain browser-mounted Vue app.

Failed builds keep the last successful output in place, and the add-on writes a status page with generated YAML examples for every discovered page.

## Quickstart

- Install the add-on from the central add-on repository: `https://github.com/LordMike/hass-addons`
- Install and start **hass-vue**.
- Open `/local/hass-vue/status.html` after the first build, then edit `/config/hass-vue/pages/example/index.vue`.
- With the **Studio Code Server** add-on, open its Web UI and edit `/config/hass-vue` directly from the Explorer.

## Features

- Vue SFC pages compiled with Vite
- One independent output module per page folder
- Lovelace card, `panel_custom`, and plain browser module support
- Stable `/local/hass-vue/pages/<slug>/page.js` URLs with cache-busting versioned modules
- Stable `/local/hass-vue/pages/all.js` macro module that registers every successfully built page
- Last-good output preserved when a build fails
- Status HTML/JSON with generated YAML snippets
- Screenshot readiness events and snapshot mode for deterministic captures

## Usage

Create a page:

```text
/config/hass-vue/pages/dashboard/index.vue
```

The add-on builds it to:

```text
/config/www/hass-vue/pages/dashboard/page.js
/local/hass-vue/pages/dashboard/page.js
/local/hass-vue/pages/all.js
```

Add `/local/hass-vue/pages/all.js` as a JavaScript module resource in Home Assistant's dashboard resource UI. In storage mode this is managed from `Settings > Dashboards`, not from the card YAML itself. The `all.js` module imports every successfully built page, so one resource covers all generated card types.

Then use the generated card type in a dashboard view. Lovelace card mode is the preferred setup; use a panel view when the page should fill the dashboard content area:

```yaml
views:
  - title: Dashboard
    panel: true # Make this full screen.
    cards:
      - type: custom:hass-vue-page-dashboard
```

The same page can be mounted as a Home Assistant sidebar panel with `panel_custom`:

```yaml
panel_custom:
  - name: hass-vue-page-dashboard
    sidebar_title: Dashboard
    sidebar_icon: mdi:tablet-dashboard
    module_url: /local/hass-vue/pages/dashboard/page.js
    embed_iframe: false
    require_admin: false
```

## Default Page

When `create_example` is enabled and no pages exist, the add-on creates:

```text
/config/hass-vue/pages/example/index.vue
/config/hass-vue/pages/example/page.json
```

The bundled example page is a Home Assistant-aware Vue dashboard. It shows connection status, live time, entity count, unavailable entity count, `sun.sun`, largest domains, recently updated entities, and a small update log. It uses the runtime helpers from `@hass-vue/hass`, including `hassRef`, `hassSnapshotRef`, and snapshot state reads.

Edit that page, wait for a successful rebuild in the add-on log or status page, then refresh the Home Assistant page that loads the module.

## Configuration

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `dev_server` | no | `false` | Exposes the status/development endpoint through Home Assistant Ingress on port `8099`. Static `/local` output remains authoritative. |
| `log_level` | no | `info` | Use `debug` while diagnosing watcher or build behavior. |
| `create_example` | no | `true` | Creates the bundled example page when `/config/hass-vue/pages` has no page folders. |
| `source_root` | no | `/config/hass-vue` | Home Assistant config path that contains `pages/` and `shared/`. Relative values are treated as folders under `/config`. |
| `output_root` | no | `/config/www/hass-vue` | Home Assistant config path where built browser modules are written. Keep this under `/config/www` so Home Assistant can serve it as `/local`. For example, `/config/www/custom-vue` is served as `/local/custom-vue`. |

Both path options must stay under `/config`. The source root cannot be inside `/config/www`, and source/output roots cannot overlap.

## Add-on Image

This repository contains the `hass-vue` app source and Docker image build. User-facing Home Assistant add-on installation is published through the central add-on repository at `https://github.com/LordMike/hass-addons`.

```text
app/
  package.json
  src/
  test/
Dockerfile
run.sh
```

Home Assistant installs from `hass-addons` use the published multi-arch Docker image declared by that repository's add-on metadata:

```text
ghcr.io/lordmike/hass-vue
```

The add-on image installs Node dependencies at image build time with:

```bash
npm ci --ignore-scripts --omit=dev
```

At runtime it watches the configured `source_root` inside the add-on container. With defaults, users see those source folders as `/config/hass-vue/pages` and `/config/hass-vue/shared` in Home Assistant file editors such as Studio Code Server, while the add-on sees them as `/ha-config/hass-vue/pages` and `/ha-config/hass-vue/shared`. Built output is written to the configured `output_root`; with defaults this is `/ha-config/www/hass-vue` inside the add-on and `/config/www/hass-vue` for users, served by Home Assistant as `/local/hass-vue`.

Version tags must use plain numeric semantic versions such as `1.2.3`. The release workflow intentionally rejects the usual `v1.2.3` prefix because Home Assistant add-on versions require the unprefixed form.

Tagged releases publish Docker images to GitHub Container Registry:

```text
ghcr.io/lordmike/hass-vue:<a.b.c>
ghcr.io/lordmike/hass-vue:latest
```

## Development

Run the validation script from the app folder:

```bash
cd app
npm ci
npm run validate
```

The validation creates temporary Home Assistant-like folders, verifies example creation, builds a test Vue page, checks stable loader output, confirms failed builds keep the last-good module, and validates marker-gated deletion.

## Security

Anyone who can edit `/config/hass-vue` can create JavaScript that runs inside the Home Assistant frontend for the logged-in browser session. Treat page authors as trusted Home Assistant frontend code authors.

Do not put secrets, tokens, credentialed URLs, or sensitive rendered data in page source or generated output. Home Assistant serves `/config/www` content publicly under `/local` to anyone who can reach the URL.

## Status

I make open source software in my free time and share it so others can use it, learn from it, or build on it. The project is provided as-is with no guarantees about quality, correctness, or support. Issues and pull requests are welcome, but there is no guarantee of response time, fixes, or ongoing maintenance.

[Project license](LICENSE.txt).
