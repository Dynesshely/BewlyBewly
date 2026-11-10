<script setup lang="ts">
import { openLinkToNewTab } from '~/utils/main'

import { NATIVE_MOMENTS_URL, useMomentsI18n } from './i18n'

/**
 * 动态占位页。
 *
 * 动态流的真实内容由原生 t.bilibili.com 提供，这里交付：
 * 1. 明确的说明（为什么是占位）；
 * 2. 与最终信息结构一致的骨架（正文 + 图片宫格 + 操作条）；
 * 3. 直达原生动态页的按钮（键盘可达）。
 */
const { t } = useMomentsI18n()

const skeletonCards = [
  { media: 'image', lines: 3 },
  { media: 'video', lines: 2 },
  { media: 'image', lines: 4 },
] as const

function openNativeMoments() {
  openLinkToNewTab(NATIVE_MOMENTS_URL)
}
</script>

<template>
  <div class="moments-placeholder">
    <header class="moments-head">
      <div class="moments-heading">
        <span class="moments-badge">{{ t('badge') }}</span>
        <h2 class="moments-title">
          {{ t('title') }}
        </h2>
        <p class="moments-subtitle">
          {{ t('subtitle') }}
        </p>
      </div>
      <button type="button" class="moments-cta" @click="openNativeMoments">
        <span class="i-tabler:arrow-up-right" aria-hidden="true" />
        <span>{{ t('open_native') }}</span>
      </button>
    </header>

    <section class="moments-body" :aria-label="t('title')">
      <div class="moments-skeleton" aria-hidden="true">
        <article v-for="(card, index) in skeletonCards" :key="index" class="skeleton-card">
          <div class="skeleton-head">
            <span class="skeleton-avatar" />
            <div class="skeleton-meta">
              <span class="skeleton-line skeleton-line--name" />
              <span class="skeleton-line skeleton-line--time" />
            </div>
          </div>
          <div class="skeleton-text">
            <span
              v-for="line in card.lines"
              :key="line"
              class="skeleton-line"
              :class="{ 'skeleton-line--short': line === card.lines }"
            />
          </div>
          <div
            class="skeleton-media"
            :class="card.media === 'video' ? 'skeleton-media--video' : 'skeleton-media--image'"
          />
          <div class="skeleton-actions">
            <span class="skeleton-pill">{{ t('skeleton_like') }}</span>
            <span class="skeleton-pill">{{ t('skeleton_comment') }}</span>
            <span class="skeleton-pill">{{ t('skeleton_forward') }}</span>
          </div>
        </article>
      </div>

      <aside class="moments-note">
        <p class="moments-note-hint">
          {{ t('skeleton_note') }}
        </p>

        <h3 class="moments-note-title">
          {{ t('why_title') }}
        </h3>
        <p class="moments-note-body">
          {{ t('why_body') }}
        </p>

        <h3 class="moments-note-title">
          {{ t('plan_title') }}
        </h3>
        <ul class="moments-note-list">
          <li>{{ t('plan_1') }}</li>
          <li>{{ t('plan_2') }}</li>
          <li>{{ t('plan_3') }}</li>
        </ul>

        <div class="moments-note-actions">
          <button type="button" class="moments-cta moments-cta--ghost" @click="openNativeMoments">
            <span class="i-tabler:external-link" aria-hidden="true" />
            <span>{{ t('open_native') }}</span>
          </button>
          <span class="moments-note-hint">{{ t('open_native_hint') }}</span>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped lang="scss">
.moments-placeholder {
  --moments-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --moments-duration: 200ms;

  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}

.moments-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.moments-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 720px;
}

.moments-badge {
  align-self: flex-start;
  padding: 0 8px;
  border-radius: 8px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 12px;
  line-height: 22px;
}

.moments-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
}

.moments-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.moments-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: var(--bew-theme-color);
  color: white;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition:
    opacity var(--moments-duration) var(--moments-ease),
    background var(--moments-duration) var(--moments-ease),
    transform var(--moments-duration) var(--moments-ease);

  &:hover {
    opacity: 0.88;
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  &--ghost {
    border: 1px solid var(--bew-border-color);
    background: transparent;
    color: var(--bew-text-2);

    &:hover {
      background: var(--bew-fill-2);
      color: var(--bew-text-1);
      opacity: 1;
    }
  }
}

.moments-body {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;

  @media (max-width: 980px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.moments-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
}

.skeleton-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skeleton-avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bew-skeleton);
  animation: moments-pulse 1.6s ease-in-out infinite;
}

.skeleton-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.skeleton-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  display: block;
  height: 10px;
  border-radius: 5px;
  background: var(--bew-skeleton);
  animation: moments-pulse 1.6s ease-in-out infinite;

  &--name {
    width: 120px;
  }

  &--time {
    width: 64px;
    height: 8px;
  }

  &--short {
    width: 62%;
  }
}

.skeleton-media {
  border-radius: 12px;
  background: var(--bew-skeleton);
  animation: moments-pulse 1.6s ease-in-out infinite;

  &--image {
    height: 132px;
  }

  &--video {
    height: 108px;
  }
}

.skeleton-actions {
  display: flex;
  gap: 12px;
}

.skeleton-pill {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--bew-fill-1);
  color: var(--bew-text-4);
  font-size: 12px;
  line-height: 20px;
}

.moments-note {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border: 1px dashed var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated-alt);
}

.moments-note-title {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
}

.moments-note-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--bew-text-2);
}

.moments-note-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--bew-text-2);
  font-size: 13px;
  line-height: 1.6;
}

.moments-note-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.moments-note-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

@keyframes moments-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moments-placeholder *,
  .moments-placeholder *::before,
  .moments-placeholder *::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>
