<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { getSnapshotStateValue, hassRef, hassSnapshotRef } from '@ha-vue/hass';

const now = ref(new Date());
const updateLog = ref([]);
let timer;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onUnmounted(() => window.clearInterval(timer));

const activeHass = computed(() => hassSnapshotRef.value || hassRef.value);
const states = computed(() => activeHass.value?.states ?? {});
const entityList = computed(() => Object.values(states.value));
const entityCount = computed(() => entityList.value.length);
const connected = computed(() => Boolean(activeHass.value));
const snapshotMode = computed(() => Boolean(hassSnapshotRef.value));
const connectionText = computed(() => {
  if (snapshotMode.value) return 'Snapshot rendered';
  return connected.value ? 'Connected to Home Assistant' : 'Waiting for hass';
});

const latestEntity = computed(() => {
  return [...entityList.value].sort((a, b) => String(b.last_changed).localeCompare(String(a.last_changed)))[0];
});

const domainCounts = computed(() => {
  const counts = new Map();
  for (const entity of entityList.value) {
    const domain = entity.entity_id.split('.')[0];
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 8);
});

const unavailableCount = computed(() => {
  return entityList.value.filter((entity) => ['unavailable', 'unknown'].includes(entity.state)).length;
});

const recentEntities = computed(() => {
  return [...entityList.value]
    .sort((a, b) => String(b.last_updated).localeCompare(String(a.last_updated)))
    .slice(0, 6)
    .map((entity) => ({
      entityId: entity.entity_id,
      name: entity.attributes?.friendly_name || entity.entity_id,
      state: entity.state
    }));
});

const sunState = computed(() => getSnapshotStateValue('sun.sun') ?? states.value['sun.sun']?.state ?? 'unavailable');
const latestName = computed(() => latestEntity.value?.attributes?.friendly_name || latestEntity.value?.entity_id || 'No state updates yet');
const latestId = computed(() => latestEntity.value?.entity_id || 'hass has not been assigned yet');

watch(
  () => latestEntity.value?.entity_id + latestEntity.value?.last_changed + latestEntity.value?.state,
  () => {
    const entity = latestEntity.value;
    if (!entity) return;
    const row = {
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      entityId: entity.entity_id,
      name: entity.attributes?.friendly_name || entity.entity_id,
      state: entity.state
    };
    if (updateLog.value[0]?.entityId === row.entityId && updateLog.value[0]?.state === row.state) return;
    updateLog.value = [row, ...updateLog.value].slice(0, 8);
  },
  { immediate: true }
);
</script>

<template>
  <main class="page" :class="{ connected }">
    <header class="hero">
      <div>
        <p class="eyebrow">Home Assistant Vue module</p>
        <h1>HA Vue Builder</h1>
        <p class="intro">
          This is a sample page. Edit
          <code>/config/ha-vue/pages/example/index.vue</code>,
          wait for a successful rebuild in the app log, then refresh this Home Assistant page.
        </p>
      </div>
      <section class="status" aria-label="Connection status">
        <span class="status-dot" aria-hidden="true"></span>
        <strong>{{ connectionText }}</strong>
        <time>{{ now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</time>
      </section>
    </header>

    <dl class="metrics" aria-label="Home Assistant metrics">
      <div>
        <dt>Entities</dt>
        <dd>{{ entityCount }}</dd>
      </div>
      <div>
        <dt>Unavailable</dt>
        <dd>{{ unavailableCount }}</dd>
      </div>
      <div>
        <dt>Sun</dt>
        <dd>{{ sunState }}</dd>
      </div>
      <div>
        <dt>Domains</dt>
        <dd>{{ domainCounts.length }}</dd>
      </div>
    </dl>

    <section class="content">
      <article class="panel latest">
        <p class="label">Latest changed entity</p>
        <strong>{{ latestName }}</strong>
        <code>{{ latestId }}</code>
      </article>

      <article class="panel">
        <h2>Largest domains</h2>
        <ol class="domain-list">
          <li v-for="domain in domainCounts" :key="domain.domain">
            <span>{{ domain.domain }}</span>
            <strong>{{ domain.count }}</strong>
          </li>
        </ol>
      </article>

      <article class="panel">
        <h2>Recently updated</h2>
        <ul class="entity-list">
          <li v-for="entity in recentEntities" :key="entity.entityId">
            <span>{{ entity.name }}</span>
            <code>{{ entity.state }}</code>
          </li>
        </ul>
      </article>

      <article class="panel log">
        <h2>Recent update log</h2>
        <ol>
          <li v-for="row in updateLog" :key="`${row.at}-${row.entityId}-${row.state}`">
            <time>{{ row.at }}</time>
            <span>{{ row.name }}</span>
            <code>{{ row.state }}</code>
          </li>
        </ol>
      </article>
    </section>
  </main>
</template>

<style scoped>
.page {
  box-sizing: border-box;
  width: 960px;
  min-height: 640px;
  padding: 28px;
  color: #141414;
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 4px solid #141414;
}

.eyebrow,
.label,
dt,
code,
time {
  font-size: 14px;
  line-height: 1.2;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-top: 6px;
  font-size: 54px;
  line-height: 0.95;
}

.intro {
  max-width: 560px;
  margin-top: 12px;
  font-size: 16px;
  line-height: 1.35;
}

h2 {
  margin-bottom: 14px;
  font-size: 22px;
}

.status {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 10px;
  min-width: 260px;
  padding: 14px;
  border: 3px solid #141414;
}

.status-dot {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border: 3px solid #141414;
  background: #fff;
}

.connected .status-dot {
  background: #141414;
}

.status strong,
.status time {
  display: block;
}

.status time {
  grid-column: 2;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 18px 0;
  padding: 0;
}

.metrics div,
.panel {
  border: 3px solid #141414;
  padding: 16px;
}

.metrics dt {
  display: block;
  margin-bottom: 10px;
  letter-spacing: 0;
}

.metrics dd {
  display: block;
  margin: 0;
  font-size: 38px;
  line-height: 1;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.latest {
  grid-column: 1 / -1;
}

.latest strong {
  display: block;
  margin: 8px 0;
  font-size: 30px;
  line-height: 1.05;
}

.domain-list,
.entity-list,
.log ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.domain-list li,
.entity-list li,
.log li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: baseline;
  padding-bottom: 8px;
  border-bottom: 1px solid #141414;
}

.log li {
  grid-template-columns: 74px minmax(0, 1fr) auto;
}

.domain-list li:last-child,
.entity-list li:last-child,
.log li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

span,
strong,
code {
  overflow-wrap: anywhere;
}

code {
  text-transform: none;
}
</style>
