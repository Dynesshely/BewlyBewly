<script setup lang="ts">
import type { ProbeItem } from './types'
import { useDiagnosticsMessages } from './i18n'

import { useDiagnosticsPanel } from './panel'

/**
 * 页面自检结果面板（第 24 轮）。
 *
 * 纯本地：点击「运行页面自检」只做 DOM 查询，不发网络请求；「复制为 Markdown」把结果串复制到剪贴板。
 * 结果分「正常 / 降级 / 不可用」三组，读屏通过 role="status" 播报摘要。
 */
const t = useDiagnosticsMessages()
const { result, copied, run, copyMarkdown, reasonOf } = useDiagnosticsPanel()

/** 三个状态分组（避免模板里内联 filter 造成隐式 any） */
const groups = computed(() => {
  const items = result.value?.items ?? []
  return {
    ok: items.filter((item: ProbeItem) => item.status === 'ok'),
    // 设置页覆盖导致无法探测的项单独列出，不计入「降级」
    degraded: items.filter((item: ProbeItem) => item.status === 'degraded' && !item.covering),
    unavailable: items.filter((item: ProbeItem) => item.status === 'unavailable'),
    covering: items.filter((item: ProbeItem) => item.covering),
  }
})
</script>

<template>
  <div class="diagnostics">
    <p class="diagnostics__desc">
      {{ t.desc }}
    </p>

    <div class="diagnostics__actions">
      <button type="button" class="diagnostics__btn" @click="run">
        {{ result ? t.rerun : t.run }}
      </button>
      <button
        v-if="result"
        type="button"
        class="diagnostics__btn is-ghost"
        :disabled="!result"
        @click="copyMarkdown"
      >
        {{ copied ? t.copied : t.copy }}
      </button>
    </div>

    <p v-if="!result" class="diagnostics__hint" role="status">
      {{ t.emptyHint }}
    </p>

    <template v-else>
      <p class="diagnostics__summary" role="status" aria-live="polite">
        {{ t.summary.replace('{ok}', String(result.okCount)).replace('{degraded}', String(result.degradedCount)).replace('{unavailable}', String(result.unavailableCount)) }}
        <template v-if="result.coveringCount">
          · {{ t.summaryCovering.replace('{covering}', String(result.coveringCount)) }}
        </template>
      </p>

      <p v-if="result.coveredBySettings" class="diagnostics__hint is-covering" role="status">
        {{ t.coveringOverlayHint }}
      </p>

      <dl class="diagnostics__env">
        <dt>{{ t.pageType }}</dt>
        <dd>{{ t.pageKindLabels[result.pageKind] ?? result.pageKind }}</dd>
        <dt>{{ t.browser }}</dt>
        <dd class="diagnostics__mono">
          {{ result.env.userAgent }}
        </dd>
        <dt>{{ t.viewport }}</dt>
        <dd>{{ result.env.viewport }} @ {{ result.env.devicePixelRatio }}x</dd>
        <dt>{{ t.dark }}</dt>
        <dd>{{ result.env.dark ? t.yes : t.no }}</dd>
        <dt>{{ t.reducedMotion }}</dt>
        <dd>{{ result.env.reducedMotion ? t.yes : t.no }}</dd>
        <dt>{{ t.bewlyMounted }}</dt>
        <dd>{{ result.env.bewlyMounted ? t.yes : t.no }}</dd>
      </dl>

      <div
        v-for="group in (['covering', 'ok', 'degraded', 'unavailable'] as const)"
        :key="group"
        class="diagnostics__group"
      >
        <template v-if="groups[group].length">
          <h4 class="diagnostics__group-title">
            {{ group === 'ok' ? t.statusOk : group === 'degraded' ? t.statusDegraded : group === 'covering' ? t.statusCovering : t.statusUnavailable }}
            ({{ groups[group].length }})
          </h4>
          <ul class="diagnostics__list">
            <li
              v-for="item in groups[group]"
              :key="item.name"
              class="diagnostics__item"
            >
              <span class="diagnostics__name">{{ item.name }}</span>
              <span class="diagnostics__reason">{{ reasonOf(item) }}</span>
              <span v-if="item.hostId" class="diagnostics__meta">
                #{{ item.hostId }} · {{ item.hostMounted ? t.hostMounted : t.hostNotMounted }}
              </span>
              <span class="diagnostics__meta">
                {{ t.selectorsHit }}：{{ item.matchedCount }} / {{ item.selectorCount }}
              </span>
            </li>
          </ul>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.diagnostics {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 0;
}

.diagnostics__desc,
.diagnostics__hint,
.diagnostics__summary {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--bew-text-2);
}

.diagnostics__hint.is-covering {
  padding: 0.5rem 0.75rem;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border-left: 3px solid var(--bew-theme-color);
  border-radius: 6px;
}

.diagnostics__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.diagnostics__btn {
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--bew-theme-color);
  border-radius: 999px;
  color: #fff;
  font-size: 0.8125rem;
  background: var(--bew-theme-color);
  cursor: pointer;
}

.diagnostics__btn.is-ghost {
  color: var(--bew-text-2);
  background: transparent;
  border-color: var(--bew-border-color);
}

.diagnostics__btn:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.diagnostics__env {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  margin: 0;
  font-size: 0.75rem;
  color: var(--bew-text-2);
}

.diagnostics__env dt {
  color: var(--bew-text-3);
}

.diagnostics__env dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.diagnostics__mono {
  font-family: var(--bew-code-font, monospace);
  font-size: 0.7rem;
}

.diagnostics__group-title {
  margin: 0.5rem 0 0.25rem;
  font-size: 0.8125rem;
  color: var(--bew-text-1);
}

.diagnostics__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.diagnostics__item {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  background: var(--bew-fill-1);
  border-radius: var(--bew-radius-sm, 8px);
}

.diagnostics__name {
  font-weight: 600;
  color: var(--bew-text-1);
}

.diagnostics__reason {
  color: var(--bew-text-2);
}

.diagnostics__meta {
  color: var(--bew-text-3);
}

@media (prefers-contrast: more) {
  .diagnostics__item {
    border: 1px solid var(--bew-text-3);
  }
}

@media (forced-colors: active) {
  .diagnostics__item {
    border: 1px solid CanvasText;
  }
}
</style>
