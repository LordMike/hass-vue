## Purpose

This repo is a Home Assistant add-on repository for HA Vue Builder. Optimize for predictable add-on behavior, clear generated output paths, and documentation that matches the Home Assistant install and runtime flow.

## Do / Don’t

- Do: keep `repository.yaml`, `ha_vue_builder/config.yaml`, package version, Docker labels, README, and changelog aligned when changing release metadata.
- Do: update `ha_vue_builder/DOCS.md` when changing page discovery, generated URLs, runtime helpers, status output, or security behavior.
- Don’t: commit local Home Assistant screenshots, Playwright MCP logs, generated `/config/www` output, or `node_modules`.
- Don’t: run the add-on daemon against real Home Assistant paths unless explicitly asked.

## Pushback / quality bar

- Before starting new projects or automation, evaluate whether the effort is justified and push back if build time exceeds the time it would save.
- If a request would introduce hacks, unclear behavior, or long-term maintenance risk, push back and propose a safer alternative.
- Avoid obvious performance pitfalls; call them out and offer a better approach.
- Prefer clear, simple code over clever or verbose implementations.

## Core workflows

- Build: `docker build -t ha-vue-builder ha_vue_builder`
- Test: `cd ha_vue_builder/app && npm run validate`
- Run: `cd ha_vue_builder/app && npm start` DO NOT RUN AUTOMATICALLY UNLESS ASKED TO

## Repo conventions

- Root files describe the Home Assistant add-on repository.
- Add-on implementation lives in `ha_vue_builder/`.
- Node app code lives in `ha_vue_builder/app/src/` and uses ESM modules.
- Runtime browser helpers live in `ha_vue_builder/app/src/runtime/`.
- Page slugs must match `^[a-z0-9][a-z0-9-]*$`.
- Generated page element names use `ha-vue-page-<slug>`.

## Documentation upkeep

- `README.md` — GitHub front page and quick orientation.
- `ha_vue_builder/README.md` — compact add-on README.
- `ha_vue_builder/DOCS.md` — detailed user workflow, generated YAML, runtime helper, security, and troubleshooting docs.
- `ha_vue_builder/CHANGELOG.md` — user-visible release changes.

## When to split

If this file grows beyond a page, or if the repo has distinct task areas, ask the user whether to split into sub-AGENTS files and route by task. Sub-agents must be named `AGENTS.<TASK>.md`. When sub-agents exist, the main `AGENTS.md` should be mostly a redirector and general guidance.
