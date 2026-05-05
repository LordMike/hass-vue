# hass-vue

hass-vue is a Home Assistant App that watches Vue single-file components in `/config/hass-vue/pages` and builds each page into a standalone browser JavaScript module under `/config/www/hass-vue`.

The same output can be used as a Home Assistant Lovelace custom card, a `panel_custom` page, or a plain Vue module mounted into any HTML page.

Each page is independent:

```text
/config/hass-vue/pages/example/index.vue
```

builds to:

```text
/config/www/hass-vue/pages/example/page.js
/local/hass-vue/pages/example/page.js
```

Use it as a Lovelace resource:

```yaml
resources:
  - url: /local/hass-vue/pages/example/page.js
    type: module
```

Then add a card:

```yaml
type: custom:hass-vue-page-example
```

The same module can be used as `panel_custom` with `name: hass-vue-page-example`.

Install it from `https://github.com/LordMike/hass-addons`. See [DOCS.md](DOCS.md) for workflow, security notes, and troubleshooting.
