<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { Episode, Result as TimetableItem, TimetableResult } from '~/models/anime/timeTable'
import { ref } from 'vue'
import api from '~/utils/api'
import { numFormatter } from '~/utils/dataFormatter'
import { openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'

import { useAnimeI18n } from '../i18n'

/**
 * 番剧时间表（第 1 轮重做）。
 *
 * 布局：一周时间轴条 → 当日主推大卡 → 其余日卡片流。
 * 键盘：←/→ 切日、Home/End 首尾、Enter 打开当日主推；日期条内可用 Tab 进入。
 *
 * 数据仍走原来的 `api.anime.getAnimeTimeTable()`，只重组呈现，不改 API 语义。
 */
const { t, weekday } = useAnimeI18n()

const days = ref<TimetableItem[]>([])
const isLoading = ref<boolean>(true)
const loadFailed = ref<boolean>(false)
const activeIndex = ref<number>(0)
const helpOpen = ref<boolean>(false)
const liveMessage = ref<string>('')
const sectionRef = ref<HTMLElement>()
const dayButtonRefs = ref<HTMLElement[]>([])

const activeDay = computed<TimetableItem | undefined>(() => days.value[activeIndex.value])
const heroEpisode = computed<Episode | undefined>(() => activeDay.value?.episodes?.[0])
const heroOtherEpisodes = computed<Episode[]>(() => activeDay.value?.episodes?.slice(1) ?? [])

const todayIndex = computed<number>(() => days.value.findIndex(day => day.is_today === 1))
const activeIsToday = computed<boolean>(() => activeDay.value?.is_today === 1)

/** 其余日：保持周一到周日的自然顺序，只剔除当前选中日 */
const otherDays = computed<{ day: TimetableItem, index: number }[]>(() => {
  return days.value
    .map((day, index) => ({ day, index }))
    .filter(item => item.index !== activeIndex.value)
})

const heroUrl = computed<string>(() => {
  const episode = heroEpisode.value
  return episode
    ? `//www.bilibili.com/bangumi/play/ss${episode.season_id}`
    : ''
})

const heroFollowText = computed<string>(() => {
  const episode = heroEpisode.value
  if (!episode)
    return ''
  const follow = Number(episode.follow)
  if (Number.isFinite(follow) && follow > 0)
    return numFormatter(follow)
  return episode.follows || ''
})

onMounted(() => {
  void loadTimeTable()
})

async function loadTimeTable() {
  isLoading.value = true
  loadFailed.value = false
  try {
    const response = await api.anime.getAnimeTimeTable() as TimetableResult | undefined
    if (!response || response.code !== 0)
      throw new Error('timetable request failed')
    days.value = (response.result ?? []).filter(day => Array.isArray(day.episodes))
    syncActiveDay()
    announceActiveDay()
  }
  catch {
    days.value = []
    loadFailed.value = true
  }
  finally {
    isLoading.value = false
  }
}

function refreshAnimeTimeTable() {
  days.value = []
  activeIndex.value = 0
  void loadTimeTable()
}

defineExpose({ refreshAnimeTimeTable })

function syncActiveDay() {
  if (!days.value.length) {
    activeIndex.value = 0
    return
  }
  const today = days.value.findIndex(day => day.is_today === 1)
  if (today >= 0) {
    activeIndex.value = today
    return
  }
  const firstAiringDay = days.value.findIndex(day => (day.episodes?.length ?? 0) > 0)
  activeIndex.value = firstAiringDay >= 0
    ? firstAiringDay
    : 0
}

function selectDay(index: number, moveFocus = false) {
  if (!days.value.length)
    return
  const clamped = Math.min(days.value.length - 1, Math.max(0, index))
  // 点当前日也把焦点收拢到日期条上，方便接着用方向键
  const shouldFocus = moveFocus || clamped === activeIndex.value
  activeIndex.value = clamped
  announceActiveDay()
  if (shouldFocus)
    nextTick(() => dayButtonRefs.value[clamped]?.focus())
}

function goToday() {
  if (todayIndex.value < 0)
    return
  selectDay(todayIndex.value, true)
}

function announceActiveDay() {
  const day = activeDay.value
  if (!day)
    return
  const hero = heroEpisode.value
  const parts = [
    weekday(day.day_of_week),
    day.date,
  ]
  if (day.is_today === 1)
    parts.push(t('today'))
  parts.push(hero
    ? `${t('day_pick')}：${hero.title}`
    : t('empty_day'))
  liveMessage.value = parts.join(' · ')
}

function openHero() {
  const episode = heroEpisode.value
  if (!episode)
    return
  openLinkToNewTab(`https://www.bilibili.com/bangumi/play/ss${episode.season_id}`)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey)
    return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      event.stopPropagation()
      selectDay(activeIndex.value - 1, true)
      break
    case 'ArrowRight':
      event.preventDefault()
      event.stopPropagation()
      selectDay(activeIndex.value + 1, true)
      break
    case 'Home':
      event.preventDefault()
      event.stopPropagation()
      selectDay(0, true)
      break
    case 'End':
      event.preventDefault()
      event.stopPropagation()
      selectDay(days.value.length - 1, true)
      break
    case 'Enter':
      // 焦点在日期按钮 / 链接上时交给原生行为，只有落在整块区域上才打开主推
      if (event.target !== sectionRef.value)
        return
      event.preventDefault()
      event.stopPropagation()
      openHero()
      break
    default:
      break
  }
}

function setDayButton(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLElement)
    dayButtonRefs.value[index] = el
}

function episodeCover(episode: Episode) {
  return removeHttpFromUrl(episode.ep_cover || episode.cover || episode.square_cover || '')
}

function episodeThumb(episode: Episode) {
  return removeHttpFromUrl(episode.cover || episode.ep_cover || episode.square_cover || '')
}
</script>

<template>
  <section
    ref="sectionRef"
    class="anime-timetable"
    tabindex="0"
    role="group"
    :aria-label="t('timetable_title')"
    aria-describedby="anime-timetable-hint"
    @keydown="handleKeydown"
  >
    <header class="timetable-head">
      <div class="timetable-heading">
        <h3 class="timetable-title">
          {{ t('timetable_title') }}
        </h3>
        <p id="anime-timetable-hint" class="timetable-subtitle">
          {{ t('timetable_subtitle') }}
        </p>
      </div>
      <div class="timetable-tools">
        <button
          type="button"
          class="tool-btn"
          :disabled="todayIndex < 0 || activeIsToday"
          :title="t('back_to_today')"
          @click="goToday"
        >
          <span class="i-tabler:calendar-event" aria-hidden="true" />
          <span>{{ t('back_to_today') }}</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :aria-expanded="helpOpen"
          aria-controls="anime-timetable-keyboard-help"
          :title="t('keyboard_help')"
          @click="helpOpen = !helpOpen"
        >
          <span class="i-tabler:keyboard" aria-hidden="true" />
          <span>{{ t('keyboard_help') }}</span>
        </button>
      </div>
    </header>

    <p class="sr-only" aria-live="polite">
      {{ liveMessage }}
    </p>

    <transition name="help-fold">
      <div v-if="helpOpen" id="anime-timetable-keyboard-help" class="keyboard-help">
        <h4 class="keyboard-help-title">
          {{ t('keyboard_help_title') }}
        </h4>
        <dl class="keyboard-help-list">
          <div class="keyboard-help-row">
            <dt><kbd>←</kbd> <kbd>→</kbd></dt>
            <dd>{{ t('key_prev_day') }} / {{ t('key_next_day') }}</dd>
          </div>
          <div class="keyboard-help-row">
            <dt><kbd>Home</kbd> <kbd>End</kbd></dt>
            <dd>{{ t('key_first_day') }} / {{ t('key_last_day') }}</dd>
          </div>
          <div class="keyboard-help-row">
            <dt><kbd>Enter</kbd></dt>
            <dd>{{ t('key_open') }}</dd>
          </div>
          <div class="keyboard-help-row">
            <dt><kbd>Tab</kbd></dt>
            <dd>{{ t('key_switch_day') }}</dd>
          </div>
        </dl>
      </div>
    </transition>

    <!-- 加载中 -->
    <div v-if="isLoading && !days.length" class="timetable-loading" role="status">
      <div class="week-strip week-strip--skeleton">
        <span v-for="item in 7" :key="item" class="week-chip-skeleton" />
      </div>
      <div class="hero-skeleton" />
      <p class="timetable-note">
        {{ t('loading') }}
      </p>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadFailed" class="timetable-empty" role="alert">
      <span class="i-tabler:cloud-off" aria-hidden="true" />
      <p>{{ t('load_failed') }}</p>
      <button type="button" class="tool-btn" @click="refreshAnimeTimeTable">
        <span class="i-tabler:refresh" aria-hidden="true" />
        <span>{{ t('retry') }}</span>
      </button>
    </div>

    <!-- 空数据 -->
    <div v-else-if="!days.length" class="timetable-empty">
      <span class="i-tabler:calendar-off" aria-hidden="true" />
      <p>{{ t('empty') }}</p>
    </div>

    <template v-else>
      <!-- 一周时间轴条 -->
      <div class="week-strip" role="tablist" :aria-label="t('timetable_title')">
        <button
          v-for="(day, index) in days"
          :key="day.date_ts"
          :ref="el => setDayButton(el, index)"
          type="button"
          role="tab"
          class="week-chip"
          :class="{
            'week-chip--active': index === activeIndex,
            'week-chip--today': day.is_today === 1,
            'week-chip--empty': !day.episodes?.length,
          }"
          :aria-selected="index === activeIndex"
          :tabindex="index === activeIndex ? 0 : -1"
          :title="`${weekday(day.day_of_week)} ${day.date}`"
          @click="selectDay(index)"
        >
          <span class="week-chip-weekday">{{ weekday(day.day_of_week) }}</span>
          <span class="week-chip-date">{{ day.date }}</span>
          <span v-if="day.is_today === 1" class="week-chip-today">{{ t('today') }}</span>
          <span class="week-chip-count" aria-hidden="true">{{ day.episodes?.length ?? 0 }}</span>
          <span class="week-chip-bar" aria-hidden="true" />
        </button>
      </div>

      <!-- 当日主推大卡 -->
      <article v-if="activeDay && heroEpisode" class="day-hero">
        <a
          class="hero-cover"
          :href="heroUrl"
          target="_blank"
          rel="noopener"
          tabindex="-1"
          :aria-label="`${heroEpisode.title} ${t('open_in_new_tab')}`"
        >
          <img
            :src="`${episodeCover(heroEpisode)}@672w_378h_1c.webp`"
            :alt="heroEpisode.title"
            loading="lazy"
            decoding="async"
            fetchpriority="high"
          >
          <span class="hero-badge">
            {{ activeIsToday ? t('today_pick') : t('day_pick') }}
          </span>
        </a>

        <div class="hero-body">
          <div class="hero-headline">
            <span class="hero-weekday">{{ weekday(activeDay.day_of_week) }}</span>
            <span class="hero-date">{{ activeDay.date }}</span>
            <span v-if="activeIsToday" class="hero-today">{{ t('today') }}</span>
            <span class="hero-count">{{ t('n_episodes', { n: activeDay.episodes?.length ?? 0 }) }}</span>
          </div>

          <h4 class="hero-title">
            {{ heroEpisode.title }}
          </h4>

          <div class="hero-meta">
            <span v-if="heroEpisode.pub_time" class="hero-pill">{{ t('airs_at', { time: heroEpisode.pub_time }) }}</span>
            <span v-if="heroEpisode.pub_index" class="hero-pill">{{ heroEpisode.pub_index }}</span>
            <span v-if="heroFollowText" class="hero-pill">{{ t('follows', { count: heroFollowText }) }}</span>
            <span v-if="heroEpisode.delay" class="hero-pill hero-pill--delay">{{ heroEpisode.delay_reason }}</span>
          </div>

          <div class="hero-actions">
            <a class="hero-cta" :href="heroUrl" target="_blank" rel="noopener">
              <span class="i-tabler:player-play-filled" aria-hidden="true" />
              <span>{{ t('watch_now') }}</span>
            </a>
            <button type="button" class="hero-ghost" @click="openHero">
              <span class="i-tabler:external-link" aria-hidden="true" />
              <span>{{ t('open_in_new_tab') }}</span>
            </button>
          </div>

          <div v-if="heroOtherEpisodes.length" class="hero-more">
            <span class="hero-more-label">{{ t('more_today') }}</span>
            <ul class="hero-more-list">
              <li v-for="episode in heroOtherEpisodes" :key="episode.season_id">
                <a
                  class="hero-more-item"
                  :href="`//www.bilibili.com/bangumi/play/ss${episode.season_id}`"
                  target="_blank"
                  rel="noopener"
                  :title="episode.title"
                >
                  <span class="hero-more-time">{{ episode.pub_time }}</span>
                  <img
                    class="hero-more-thumb"
                    :src="`${episodeThumb(episode)}@96w_96h_1c.webp`"
                    :alt="episode.title"
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                  >
                  <span class="hero-more-title">{{ episode.title }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </article>

      <div v-else-if="activeDay" class="day-hero day-hero--empty">
        <span class="i-tabler:calendar-off" aria-hidden="true" />
        <p>{{ t('empty_day') }}</p>
      </div>

      <!-- 其余日卡片流 -->
      <div class="other-days">
        <div class="other-days-head">
          <h4 class="other-days-title">
            {{ t('other_days') }}
          </h4>
          <span class="other-days-hint">{{ t('other_days_hint') }}</span>
        </div>

        <div class="day-grid">
          <div
            v-for="item in otherDays"
            :key="item.day.date_ts"
            class="day-card"
            :class="{ 'day-card--today': item.day.is_today === 1 }"
            role="button"
            tabindex="0"
            :aria-label="`${weekday(item.day.day_of_week)} ${item.day.date} · ${t('n_episodes', { n: item.day.episodes?.length ?? 0 })}`"
            @click="selectDay(item.index)"
            @keydown.enter.prevent="selectDay(item.index, true)"
            @keydown.space.prevent="selectDay(item.index, true)"
          >
            <header class="day-card-head">
              <span class="day-card-weekday">{{ weekday(item.day.day_of_week) }}</span>
              <span class="day-card-date">{{ item.day.date }}</span>
              <span v-if="item.day.is_today === 1" class="day-card-today">{{ t('today') }}</span>
              <span class="day-card-count">{{ t('n_episodes', { n: item.day.episodes?.length ?? 0 }) }}</span>
            </header>

            <ul v-if="item.day.episodes?.length" class="day-card-list">
              <li v-for="episode in item.day.episodes.slice(0, 3)" :key="episode.season_id" class="day-card-ep">
                <span class="day-card-time">{{ episode.pub_time }}</span>
                <span class="day-card-ep-title">{{ episode.title }}</span>
              </li>
            </ul>
            <p v-else class="day-card-empty">
              {{ t('empty_day') }}
            </p>

            <span v-if="(item.day.episodes?.length ?? 0) > 3" class="day-card-more">
              +{{ (item.day.episodes?.length ?? 0) - 3 }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.anime-timetable {
  --timetable-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --timetable-duration: 200ms;

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
  box-shadow: var(--bew-shadow-1);
  outline: none;
  transition: box-shadow var(--timetable-duration) var(--timetable-ease);

  &:focus-visible {
    box-shadow:
      var(--bew-shadow-2),
      0 0 0 2px var(--bew-theme-color-40);
  }
}

.timetable-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.timetable-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timetable-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
}

.timetable-subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.timetable-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    background var(--timetable-duration) var(--timetable-ease),
    color var(--timetable-duration) var(--timetable-ease);

  &:hover:not(:disabled) {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.keyboard-help {
  padding: 12px 16px;
  border: 1px dashed var(--bew-border-color);
  border-radius: 12px;
  background: var(--bew-fill-1);
}

.keyboard-help-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--bew-text-2);
}

.keyboard-help-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.keyboard-help-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--bew-text-2);

  dt {
    display: flex;
    gap: 4px;
  }

  dd {
    margin: 0;
  }

  kbd {
    min-width: 24px;
    padding: 2px 6px;
    border: 1px solid var(--bew-border-color);
    border-radius: 6px;
    background: var(--bew-elevated);
    color: var(--bew-text-1);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    text-align: center;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- 一周时间轴条 ---------- */
.week-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  padding: 4px;
  border-radius: 12px;
  background: var(--bew-fill-1);

  @media (max-width: 900px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.week-chip {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  padding: 8px 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--bew-text-3);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--timetable-duration) var(--timetable-ease),
    color var(--timetable-duration) var(--timetable-ease),
    transform var(--timetable-duration) var(--timetable-ease);

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 1px;
  }

  &--active {
    background: var(--bew-elevated);
    border-color: var(--bew-theme-color-40);
    color: var(--bew-text-1);
    box-shadow: var(--bew-shadow-1);
  }

  &--active:hover {
    background: var(--bew-elevated);
  }

  &--today .week-chip-weekday {
    color: var(--bew-theme-color);
  }

  &--empty {
    opacity: 0.55;
  }
}

.week-chip-weekday {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.week-chip-date {
  font-size: 12px;
  color: var(--bew-text-3);
}

.week-chip-today {
  margin-top: 2px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 11px;
  line-height: 18px;
}

.week-chip-count {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  color: var(--bew-text-4);
}

.week-chip-bar {
  position: absolute;
  right: 10px;
  bottom: 6px;
  left: 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--bew-fill-3);
  transition: background var(--timetable-duration) var(--timetable-ease);
}

.week-chip--active .week-chip-bar {
  background: var(--bew-theme-color);
}

/* ---------- 当日主推大卡 ---------- */
.day-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 20px;
  padding: 16px;
  border-radius: var(--bew-radius);
  background: var(--bew-elevated-alt);

  @media (max-width: 860px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.hero-cover {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 12px;
  background: var(--bew-skeleton);

  img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 12px;
    transition: transform var(--timetable-duration) var(--timetable-ease);
  }

  &:hover img {
    transform: scale(1.03);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.hero-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--bew-theme-color);
  color: white;
  font-size: 12px;
  line-height: 22px;
}

.hero-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.hero-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--bew-text-3);
}

.hero-weekday {
  font-size: 16px;
  font-weight: 700;
  color: var(--bew-text-1);
}

.hero-today {
  padding: 0 8px;
  border-radius: 6px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  line-height: 20px;
}

.hero-count {
  margin-left: auto;
}

.hero-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-pill {
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 20px;

  &--delay {
    background: var(--bew-warning-color-10);
    color: var(--bew-warning-color);
  }
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-cta,
.hero-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--timetable-duration) var(--timetable-ease),
    transform var(--timetable-duration) var(--timetable-ease);

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.hero-cta {
  background: var(--bew-theme-color);
  color: white;

  &:hover {
    opacity: 0.88;
  }
}

.hero-ghost {
  border: 1px solid var(--bew-border-color);
  background: transparent;
  color: var(--bew-text-2);

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }
}

.hero-more {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.hero-more-label {
  font-size: 12px;
  color: var(--bew-text-3);
}

.hero-more-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 168px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.hero-more-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--bew-text-2);
  text-decoration: none;
  transition: background var(--timetable-duration) var(--timetable-ease);

  &:hover {
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 1px;
  }
}

.hero-more-time {
  flex: none;
  font-size: 12px;
  color: var(--bew-theme-color);
}

.hero-more-thumb {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
}

.hero-more-title {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-hero--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  color: var(--bew-text-3);
  font-size: 13px;

  > span {
    font-size: 28px;
  }

  p {
    margin: 0;
  }
}

/* ---------- 其余日卡片流 ---------- */
.other-days {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.other-days-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.other-days-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--bew-text-1);
}

.other-days-hint {
  font-size: 12px;
  color: var(--bew-text-3);
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

.day-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--bew-border-color);
  border-radius: 12px;
  background: var(--bew-elevated);
  cursor: pointer;
  transition:
    background var(--timetable-duration) var(--timetable-ease),
    border-color var(--timetable-duration) var(--timetable-ease),
    transform var(--timetable-duration) var(--timetable-ease);

  &:hover {
    background: var(--bew-elevated-alt);
    border-color: var(--bew-theme-color-40);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  &--today {
    border-color: var(--bew-theme-color-40);
  }
}

.day-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}

.day-card-weekday {
  font-size: 14px;
  font-weight: 600;
  color: var(--bew-text-1);
}

.day-card-date {
  font-size: 12px;
  color: var(--bew-text-3);
}

.day-card-today {
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 11px;
  line-height: 18px;
}

.day-card-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--bew-text-4);
}

.day-card-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.day-card-ep {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--bew-text-2);
}

.day-card-time {
  flex: none;
  color: var(--bew-theme-color);
}

.day-card-ep-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-card-empty {
  margin: 0;
  font-size: 12px;
  color: var(--bew-text-3);
}

.day-card-more {
  align-self: flex-start;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-fill-1);
  color: var(--bew-text-3);
  font-size: 11px;
  line-height: 18px;
}

/* ---------- 骨架 / 空状态 ---------- */
.week-strip--skeleton {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  padding: 4px;
  background: transparent;
}

.week-chip-skeleton {
  height: 58px;
  border-radius: 10px;
  background: var(--bew-skeleton);
  animation: timetable-pulse 1.4s ease-in-out infinite;
}

.hero-skeleton {
  height: 220px;
  border-radius: var(--bew-radius);
  background: var(--bew-skeleton);
  animation: timetable-pulse 1.4s ease-in-out infinite;
}

.timetable-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timetable-note {
  margin: 0;
  font-size: 12px;
  color: var(--bew-text-3);
}

.timetable-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  color: var(--bew-text-3);
  font-size: 13px;

  > span {
    font-size: 28px;
  }

  p {
    margin: 0;
  }
}

@keyframes timetable-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

.help-fold-enter-active,
.help-fold-leave-active {
  transition:
    opacity var(--timetable-duration) var(--timetable-ease),
    transform var(--timetable-duration) var(--timetable-ease);
}

.help-fold-enter-from,
.help-fold-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .anime-timetable *,
  .anime-timetable *::before,
  .anime-timetable *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>
