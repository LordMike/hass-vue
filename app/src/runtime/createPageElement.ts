import { createApp, nextTick, type App, type Component } from 'vue';
import { refreshHassSnapshot, registerReadinessController, setHass } from './hass';

export type MountedHassVuePage = {
  app: App<Element>;
  element: Element;
  updateHass: (hass: unknown) => void;
  markReady: (detail?: Record<string, unknown>) => void;
  markBusy: (detail?: Record<string, unknown>) => void;
  unmount: () => void;
};

export type MountHassVuePageOptions = {
  hass?: unknown;
  config?: Record<string, unknown>;
  snapshot?: boolean;
  readyMode?: 'mounted' | 'snapshot' | 'manual';
  readyTimeoutMs?: number;
};

type PageElementOptions = {
  elementName: string;
  component: Component;
};

export function mountHassVuePage(component: Component, target: Element, options: MountHassVuePageOptions = {}): MountedHassVuePage {
  injectStoredStyles(target);
  const readiness = createReadiness(target);
  const unregisterReadiness = registerReadinessController(readiness);
  const readyMode = options.readyMode || (options.snapshot ? 'snapshot' : 'mounted');
  const readyTimeout = window.setTimeout(() => {
    readiness.markReady({ reason: 'timeout', readyMode });
  }, options.readyTimeoutMs ?? 5000);

  if (options.hass) setHass(options.hass);
  if (options.snapshot && options.hass) refreshHassSnapshot(options.hass);
  const app = createApp(component, { config: options.config || {} });
  app.mount(target);

  if (readyMode === 'mounted') {
    nextTick(() => {
      requestAnimationFrame(() => readiness.markReady({ reason: 'mounted' }));
    });
  } else if (readyMode === 'snapshot' && options.hass) {
    nextTick(() => {
      requestAnimationFrame(() => readiness.markReady({ reason: 'snapshot' }));
    });
  }

  return {
    app,
    element: target,
    updateHass(hass: unknown) {
      setHass(hass);
      if (options.snapshot) {
        refreshHassSnapshot(hass);
        if (readyMode === 'snapshot') {
          nextTick(() => {
            requestAnimationFrame(() => readiness.markReady({ reason: 'snapshot' }));
          });
        }
      }
    },
    markReady(detail: Record<string, unknown> = {}) {
      readiness.markReady(detail);
    },
    markBusy(detail: Record<string, unknown> = {}) {
      readiness.markBusy(detail);
    },
    unmount() {
      window.clearTimeout(readyTimeout);
      unregisterReadiness();
      app.unmount();
    }
  };
}

export function defineHassVuePageElement({ elementName, component }: PageElementOptions) {
  if (customElements.get(elementName)) return;

  class HassVuePageElement extends HTMLElement {
    private mounted: MountedHassVuePage | null = null;
    private mountPoint: HTMLElement | null = null;
    private currentHass: unknown = null;
    private config: Record<string, unknown> = {};
    private mountOptions = readMountOptions();

    set hass(hass: unknown) {
      this.currentHass = hass;
      setHass(hass);
      this.mounted?.updateHass(hass);
    }

    get hass() {
      return this.currentHass;
    }

    setConfig(config: Record<string, unknown>) {
      this.config = config || {};
    }

    getCardSize() {
      return 1;
    }

    connectedCallback() {
      if (this.mounted) return;
      this.mountPoint = document.createElement('div');
      this.mountPoint.style.display = 'contents';
      this.appendChild(this.mountPoint);
      this.mounted = mountHassVuePage(component, this.mountPoint, {
        config: this.config,
        hass: this.currentHass,
        ...this.mountOptions
      });
    }

    disconnectedCallback() {
      this.mounted?.unmount();
      this.mounted = null;
      if (this.mountPoint?.parentNode === this) {
        this.removeChild(this.mountPoint);
      }
      this.mountPoint = null;
    }
  }

  customElements.define(elementName, HassVuePageElement);
}

function createReadiness(target: Element) {
  const host = target.parentElement || target;

  function dispatch(name: string, detail: Record<string, unknown>) {
    const event = new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail
    });
    target.dispatchEvent(event);
    if (host !== target) host.dispatchEvent(event);
  }

  return {
    markReady(detail: Record<string, unknown> = {}) {
      const payload = { ready: true, at: new Date().toISOString(), ...detail };
      setReadyAttributes(target, true, payload);
      setReadyAttributes(host, true, payload);
      dispatch('hass-vue-ready', payload);
    },
    markBusy(detail: Record<string, unknown> = {}) {
      const payload = { ready: false, at: new Date().toISOString(), ...detail };
      setReadyAttributes(target, false, payload);
      setReadyAttributes(host, false, payload);
      dispatch('hass-vue-busy', payload);
    }
  };
}

function setReadyAttributes(target: Element, ready: boolean, detail: Record<string, unknown>) {
  target.setAttribute('data-hass-vue-ready', ready ? 'true' : 'false');
  target.setAttribute('data-hass-vue-ready-at', String(detail.at || ''));
  if (detail.reason) target.setAttribute('data-hass-vue-ready-reason', String(detail.reason));
}

function readMountOptions(): Pick<MountHassVuePageOptions, 'snapshot' | 'readyMode' | 'readyTimeoutMs'> {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const snapshot = parseBoolean(params.get('hass-vue-snapshot') || params.get('snapshot'));
  const readyModeParam = params.get('hass-vue-ready') || params.get('ready');
  const readyMode = ['mounted', 'snapshot', 'manual'].includes(String(readyModeParam))
    ? readyModeParam as MountHassVuePageOptions['readyMode']
    : undefined;
  const readyTimeoutMs = Number(params.get('hass-vue-ready-timeout-ms') || params.get('readyTimeoutMs') || '');

  return {
    snapshot,
    readyMode,
    readyTimeoutMs: Number.isFinite(readyTimeoutMs) && readyTimeoutMs > 0 ? readyTimeoutMs : undefined
  };
}

function parseBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function injectStoredStyles(target: Element) {
  const styles = (globalThis as any).__HASS_VUE_BUILDER_STYLES__;
  if (!Array.isArray(styles) || styles.length === 0) return;

  const root = target.getRootNode();
  const container = root instanceof ShadowRoot
    ? root
    : document.head;

  for (const entry of styles) {
    if (!entry?.id || !entry?.css) continue;
    const selector = `style[data-hass-vue-style="${cssEscape(entry.id)}"]`;
    if (container.querySelector(selector)) continue;
    const style = document.createElement('style');
    style.setAttribute('data-hass-vue-style', entry.id);
    style.appendChild(document.createTextNode(entry.css));
    container.appendChild(style);
  }
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}
