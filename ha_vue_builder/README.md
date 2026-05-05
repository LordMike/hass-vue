# HA Vue Builder

HA Vue Builder is a Home Assistant App that watches Vue single-file components in `/share/ha-vue/pages` and builds each page into a standalone browser JavaScript module under `/config/www/ha-vue`.

The same output can be used as a Home Assistant Lovelace custom card, a `panel_custom` page, or a plain Vue module mounted into any HTML page.

Each page is independent:

```text
/share/ha-vue/pages/example/index.vue
```

builds to:

```text
/config/www/ha-vue/pages/example/page.js
/local/ha-vue/pages/example/page.js
```

Use it as a Lovelace resource:

```yaml
resources:
  - url: /local/ha-vue/pages/example/page.js
    type: module
```

Then add a card:

```yaml
type: custom:ha-vue-page-example
```

The same module can be used as `panel_custom` with `name: ha-vue-page-example`.

See [DOCS.md](DOCS.md) for installation, workflow, security notes, and troubleshooting.
