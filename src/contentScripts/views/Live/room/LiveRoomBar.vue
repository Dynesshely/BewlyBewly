<script setup lang="ts">
/**
 * 直播间顶部信息栏（自绘）。
 *
 * 位置与原生 `#head-info-vm` 完全重合（52px 高、播放器正上方），原生信息栏的内容
 * 由 `index.ts` 改成 `visibility: hidden` 保留可点状态；播放器、弹幕、礼物栏一概不碰。
 *
 * 关注按钮不自己发接口请求：点击时转发给原生关注控件（`triggerNativeFollow`），
 * 状态从 `x/relation`（只读）读回，读不到就退回原生控件上的 `data-curbutton` 标记。
 */
import type { FollowState, LiveRoomDetail } from '../types'
import { fetchFollowState, fetchRoomDetail } from '../api'
import { FOLLOW_RECHECK_DELAY, ROOM_REFRESH_INTERVAL } from '../constants'
import { readNativeFollowState, triggerNativeFollow } from '../dom'
import { useLiveI18n } from '../i18n'
import { areaLabel, faceImage, formatCount } from '../utils'

const props = defineProps<{
  roomId: number
  /** 数据就绪 → index.ts 才把原生信息栏藏起来 */
  onReady?: () => void
  /** 首屏加载失败 → index.ts 放弃接管、保留原生信息栏 */
  onFatal?: () => void
}>()

const { t } = useLiveI18n()

const detail = ref<LiveRoomDetail | null>(null)
const followed = ref<FollowState>(null)
const followPending = ref(false)

let refreshTimer: number | null = null
let disposed = false

const face = computed(() => faceImage(detail.value?.face, 72))
const area = computed(() => areaLabel(detail.value?.parentAreaName ?? '', detail.value?.areaName ?? ''))
const anchorHref = computed(() => `https://space.bilibili.com/${String(detail.value?.uid ?? 0)}`)

/** 人气 / 点赞这类会变的数字，单独刷新（不重建整个顶部栏） */
async function refreshStats() {
  if (!detail.value || disposed)
    return
  try {
    const next = await fetchRoomDetail(props.roomId)
    if (disposed)
      return
    detail.value = {
      ...detail.value,
      ...next,
    }
  }
  catch {
    // 刷新失败保持上一次的数字，不打断使用
  }
}

async function load() {
  try {
    const info = await fetchRoomDetail(props.roomId)
    if (disposed)
      return
    detail.value = info
    followed.value = await fetchFollowState(info.uid)
    if (followed.value === null)
      followed.value = readNativeFollowState()
    props.onReady?.()
    startRefresh()
  }
  catch (err) {
    if (disposed)
      return
    console.warn('[BewlyBewly] 直播间信息加载失败', err)
    props.onFatal?.()
  }
}

function startRefresh() {
  if (refreshTimer !== null)
    return
  refreshTimer = window.setInterval(() => {
    void refreshStats()
  }, ROOM_REFRESH_INTERVAL)
}

/**
 * 关注 / 取消关注：转发原生按钮后延迟回读状态。
 * 原生按钮找不到时按钮直接禁用（不给假开关）。
 */
async function toggleFollow() {
  if (followPending.value || !detail.value)
    return
  if (!triggerNativeFollow())
    return
  followPending.value = true
  window.setTimeout(async () => {
    if (disposed) {
      followPending.value = false
      return
    }
    const next = await fetchFollowState(detail.value?.uid ?? 0)
    followed.value = next ?? readNativeFollowState()
    followPending.value = false
  }, FOLLOW_RECHECK_DELAY)
}

onMounted(() => {
  void load()
})

onUnmounted(() => {
  disposed = true
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div v-if="detail" class="bew-live-bar" role="region" :aria-label="t.roomBarAria">
    <a class="bew-live-bar__anchor" :href="anchorHref" target="_blank" rel="noopener" :title="detail.title">
      <img v-if="face" class="bew-live-bar__face" :src="face" alt="" referrerpolicy="no-referrer">
      <span v-else class="bew-live-bar__face is-fallback" />
      <span class="bew-live-bar__names">
        <span class="bew-live-bar__uname">{{ detail.uname }}</span>
        <span class="bew-live-bar__meta">
          <span class="bew-live-bar__badge" :class="{ 'is-offline': !detail.live }">
            {{ detail.live ? t.liveBadge : t.offline }}
          </span>
          <span v-if="area" class="bew-live-bar__area">{{ area }}</span>
        </span>
      </span>
    </a>

    <div class="bew-live-bar__stats">
      <span v-if="detail.online > 0" class="bew-live-bar__stat">
        <span class="bew-live-bar__stat-value">{{ formatCount(detail.online) }}</span>
        <span class="bew-live-bar__stat-label">{{ t.onlineLabel }}</span>
      </span>
      <span v-if="detail.likes > 0" class="bew-live-bar__stat">
        <span class="bew-live-bar__stat-value">{{ formatCount(detail.likes) }}</span>
        <span class="bew-live-bar__stat-label">{{ t.likeLabel }}</span>
      </span>
      <span v-if="detail.followers > 0" class="bew-live-bar__stat">
        <span class="bew-live-bar__stat-value">{{ formatCount(detail.followers) }}</span>
        <span class="bew-live-bar__stat-label">{{ t.followerLabel }}</span>
      </span>
    </div>

    <button
      class="bew-live-bar__follow"
      :class="{ 'is-followed': followed === true, 'is-unknown': followed === null }"
      type="button"
      :disabled="followPending"
      @click="toggleFollow"
    >
      {{ followed === true ? t.followed : t.follow }}
    </button>
  </div>
</template>
