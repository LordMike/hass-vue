import { shallowRef } from 'vue';

export const hassRef = shallowRef<any | null>(null);
export const hassSnapshotRef = shallowRef<any | null>(null);
export const hassSnapshotReadyRef = shallowRef(false);
export const hassSnapshotCapturedAtRef = shallowRef<string | null>(null);

type ReadinessController = {
  markReady: (detail?: Record<string, unknown>) => void;
  markBusy: (detail?: Record<string, unknown>) => void;
};

const readinessControllers = new Set<ReadinessController>();

export function setHass(hass: any | null) {
  hassRef.value = hass;
}

export function refreshHassSnapshot(hass: any | null = hassRef.value) {
  if (!hass) return null;
  hassSnapshotRef.value = snapshotHass(hass);
  hassSnapshotReadyRef.value = true;
  hassSnapshotCapturedAtRef.value = new Date().toISOString();
  return hassSnapshotRef.value;
}

export function clearHassSnapshot() {
  hassSnapshotRef.value = null;
  hassSnapshotReadyRef.value = false;
  hassSnapshotCapturedAtRef.value = null;
}

export function getState(entityId: string) {
  return hassRef.value?.states?.[entityId];
}

export function getStateValue(entityId: string) {
  return getState(entityId)?.state;
}

export function getAttr(entityId: string, attrName: string) {
  return getState(entityId)?.attributes?.[attrName];
}

export function getSnapshotState(entityId: string) {
  return hassSnapshotRef.value?.states?.[entityId];
}

export function getSnapshotStateValue(entityId: string) {
  return getSnapshotState(entityId)?.state;
}

export function getSnapshotAttr(entityId: string, attrName: string) {
  return getSnapshotState(entityId)?.attributes?.[attrName];
}

export function callService(domain: string, service: string, data: Record<string, unknown> = {}, target?: Record<string, unknown>) {
  const hass = hassRef.value;
  if (!hass?.callService) {
    throw new Error('Home Assistant hass.callService is not available yet.');
  }
  return hass.callService(domain, service, data, target);
}

export function markReady(detail: Record<string, unknown> = {}) {
  for (const controller of readinessControllers) {
    controller.markReady(detail);
  }
}

export function markBusy(detail: Record<string, unknown> = {}) {
  for (const controller of readinessControllers) {
    controller.markBusy(detail);
  }
}

export function registerReadinessController(controller: ReadinessController) {
  readinessControllers.add(controller);
  return () => readinessControllers.delete(controller);
}

function snapshotHass(hass: any) {
  const states: Record<string, unknown> = {};
  for (const [entityId, state] of Object.entries(hass.states ?? {})) {
    const entityState = state as any;
    states[entityId] = {
      ...entityState,
      attributes: { ...(entityState.attributes ?? {}) }
    };
  }

  return {
    ...hass,
    states
  };
}
