<script setup lang="ts">
/**
 * 单条主评论（第 110 轮，自绘）。
 *
 * 结构（自上而下）：
 *   [头像 32 圆] 昵称 · Lv6 · 大会员 · UP 主徽章 · 置顶
 *                正文（pre-wrap 保留换行 / 表情图片 / 图片评论）
 *                时间 · IP 属地 · [UP 主点赞/回复标记] · 👍 点赞数
 *                楼中楼预览（接口在主评论里自带的 2 条，不额外请求）
 *                「共 N 条回复」→ 展开后按需拉楼中楼（/x/v2/reply/reply）
 */
import type { CommentItem } from './types'
import { computed, ref } from 'vue'
import { fetchReplies } from './fetcher'
import { fillTemplate, useCommentDrawnI18n } from './i18n'
import { avatarFallback, formatCommentTime, formatCount, splitMessage } from './utils'

const props = defineProps<{
  item: CommentItem
  /** 视频 aid，展开楼中楼时用它请求接口 */
  aid: number
}>()

const { t } = useCommentDrawnI18n()

/** 楼中楼展开状态 */
const expanded = ref(false)
const subItems = ref<CommentItem[]>([])
const subPage = ref(0)
const subHasMore = ref(false)
const subLoading = ref(false)
const subError = ref('')
/** 楼中楼总条数（接口 data.page.count；拿不到时退回主评论的 rcount） */
const subTotal = ref(0)

/** 预览条数：接口在主评论里自带 2-3 条，只展示前 2 条（与需求一致） */
const previewReplies = computed(() => props.item.replies.slice(0, 2))

/** 「共 N 条回复」里的 N */
const replyTotal = computed(() => {
  if (subTotal.value > 0)
    return subTotal.value
  if (props.item.rcount > 0)
    return props.item.rcount
  return props.item.replies.length
})

/** 正文片段（文本 + 表情图片） */
const segments = computed(() => splitMessage(props.item.message, props.item.emote))

const likeText = computed(() => formatCount(props.item.like))
const timeText = computed(() => formatCommentTime(props.item.ctime, t.value.time))
const repliesLabel = computed(() => fillTemplate(t.value.repliesCount, replyTotal.value))

async function loadSubPage(page: number): Promise<boolean> {
  if (!props.aid || subLoading.value)
    return false
  subLoading.value = true
  subError.value = ''
  try {
    const result = await fetchReplies(props.aid, props.item.rpid, page)
    if (result.total !== null)
      subTotal.value = result.total
    subItems.value = page === 1
      ? result.items
      : [
          ...subItems.value,
          ...result.items.filter(next => !subItems.value.some(prev => prev.rpid === next.rpid)),
        ]
    subPage.value = page
    subHasMore.value = result.hasMore
    return true
  }
  catch (error) {
    subError.value = (error as Error)?.message || t.value.errorTitle
    return false
  }
  finally {
    subLoading.value = false
  }
}

async function toggleExpand(): Promise<void> {
  if (expanded.value) {
    expanded.value = false
    return
  }
  expanded.value = true
  if (!subItems.value.length)
    await loadSubPage(1)
}

function retryReplies(): void {
  void loadSubPage(subPage.value + 1 || 1)
}

function loadMoreReplies(): void {
  void loadSubPage(subPage.value + 1)
}
</script>

<template>
  <article class="bcd-thread" :class="{ 'is-up': item.isUp }" :data-rpid="item.rpid">
    <div class="bcd-thread__avatar">
      <img
        v-if="item.avatar"
        class="bcd-thread__avatar-img"
        :src="item.avatar"
        :alt="item.uname"
        loading="lazy"
        referrerpolicy="no-referrer"
      >
      <span v-else class="bcd-thread__avatar-fallback" aria-hidden="true">{{ avatarFallback(item.uname) }}</span>
    </div>

    <div class="bcd-thread__main">
      <div class="bcd-thread__head">
        <span class="bcd-thread__name" :title="item.uname">{{ item.uname || t.anonymous }}</span>
        <span v-if="item.level > 0" class="bcd-thread__level">Lv{{ item.level }}</span>
        <span v-if="item.vip" class="bcd-thread__vip">{{ t.vipBadge }}</span>
        <span v-if="item.isUp" class="bcd-thread__badge bcd-thread__badge--up">{{ t.upBadge }}</span>
        <span v-if="item.isTop" class="bcd-thread__badge">{{ t.topBadge }}</span>
      </div>

      <div class="bcd-thread__text">
        <template v-for="(segment, index) in segments" :key="index">
          <img
            v-if="segment.type === 'emote' && segment.url"
            class="bcd-thread__emote"
            :src="segment.url"
            :alt="segment.value"
            loading="lazy"
            referrerpolicy="no-referrer"
          >
          <span v-else>{{ segment.value }}</span>
        </template>
      </div>

      <div v-if="item.pictures.length" class="bcd-thread__pictures">
        <a
          v-for="(src, index) in item.pictures"
          :key="index"
          class="bcd-thread__picture"
          :href="src"
          target="_blank"
          rel="noreferrer noopener"
        >
          <img :src="src" alt="" loading="lazy" referrerpolicy="no-referrer">
        </a>
      </div>

      <div class="bcd-thread__meta">
        <span v-if="timeText" class="bcd-thread__time">{{ timeText }}</span>
        <span v-if="item.location" class="bcd-thread__location">{{ item.location }}</span>
        <span v-if="item.upLiked" class="bcd-thread__flag">{{ t.upLiked }}</span>
        <span v-if="item.upReplied" class="bcd-thread__flag">{{ t.upReplied }}</span>
        <span class="bcd-thread__spacer" />
        <span class="bcd-thread__like">
          <span class="bcd-thread__like-icon" aria-hidden="true">👍</span>
          <span v-if="likeText">{{ likeText }}</span>
        </span>
      </div>

      <!-- 楼中楼预览：接口自带，不额外请求 -->
      <ul v-if="!expanded && previewReplies.length" class="bcd-thread__replies">
        <li v-for="reply in previewReplies" :key="reply.rpid" class="bcd-thread__reply">
          <span class="bcd-thread__reply-name">{{ reply.uname }}</span>
          <span class="bcd-thread__reply-colon">：</span>
          <span class="bcd-thread__reply-text">{{ reply.message }}</span>
        </li>
      </ul>

      <ul v-if="expanded" class="bcd-thread__replies bcd-thread__replies--expanded">
        <li v-for="reply in subItems" :key="reply.rpid" class="bcd-thread__reply">
          <span class="bcd-thread__reply-name">{{ reply.uname }}</span>
          <span class="bcd-thread__reply-colon">：</span>
          <span class="bcd-thread__reply-text">{{ reply.message }}</span>
          <span class="bcd-thread__reply-meta">{{ formatCommentTime(reply.ctime, t.time) }}</span>
        </li>
        <li v-if="subLoading" class="bcd-thread__reply-hint">
          {{ t.repliesLoading }}
        </li>
        <li v-else-if="subError" class="bcd-thread__reply-hint">
          {{ subError }}
          <button type="button" class="bcd-thread__link" @click="retryReplies">
            {{ t.retry }}
          </button>
        </li>
        <li v-else-if="subHasMore" class="bcd-thread__reply-hint">
          <button type="button" class="bcd-thread__link" @click="loadMoreReplies">
            {{ t.repliesLoadMore }}
          </button>
        </li>
      </ul>

      <button
        v-if="replyTotal > 0"
        type="button"
        class="bcd-thread__more"
        :aria-expanded="expanded"
        @click="toggleExpand"
      >
        {{ expanded ? t.collapseReplies : repliesLabel }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.bcd-thread {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 4px;
  border-bottom: 1px solid var(--bew-fill-1);
}

.bcd-thread.is-up {
  background: color-mix(in srgb, var(--bew-theme-color, hsl(195 100% 42%)) 4%, transparent);
}

.bcd-thread__avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  font-size: 13px;
  color: var(--bew-text-3);
  background: var(--bew-fill-1);
  border-radius: 50%;
}

.bcd-thread__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bcd-thread__avatar-fallback {
  line-height: 1;
}

.bcd-thread__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.bcd-thread__head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.bcd-thread__name {
  max-width: 100%;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--bew-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bcd-thread__level,
.bcd-thread__badge,
.bcd-thread__vip {
  flex: 0 0 auto;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  color: var(--bew-text-3);
  background: var(--bew-fill-1);
  border-radius: 3px;
}

.bcd-thread__vip {
  color: var(--bew-theme-color, hsl(340 70% 68%));
}

.bcd-thread__badge--up {
  color: #fff;
  background: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
}

.bcd-thread__text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--bew-text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.bcd-thread__emote {
  display: inline-block;
  width: 20px;
  height: 20px;
  vertical-align: text-bottom;
}

.bcd-thread__pictures {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin-top: 4px;
}

.bcd-thread__picture img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
}

.bcd-thread__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--bew-text-3);
}

.bcd-thread__spacer {
  flex: 1 1 auto;
}

.bcd-thread__like {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.bcd-thread__like-icon {
  font-size: 12px;
  filter: grayscale(1);
}

.bcd-thread__flag {
  padding: 0 4px;
  color: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
  background: var(--bew-fill-1);
  border-radius: 3px;
}

.bcd-thread__replies {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  margin: 2px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--bew-text-2);
  list-style: none;
  background: var(--bew-fill-1);
  border-radius: 6px;
}

.bcd-thread__replies--expanded {
  padding: 0;
  background: transparent;
}

.bcd-thread__reply-name {
  color: var(--bew-text-2);
}

.bcd-thread__reply-colon {
  color: var(--bew-text-3);
}

.bcd-thread__reply-text {
  color: var(--bew-text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.bcd-thread__reply-meta {
  margin-left: 6px;
  color: var(--bew-text-3);
}

.bcd-thread__reply-hint {
  color: var(--bew-text-3);
}

.bcd-thread__link,
.bcd-thread__more {
  align-self: flex-start;
  padding: 0;
  font-size: 12px;
  color: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
  cursor: pointer;
  background: none;
  border: 0;
}

.bcd-thread__more:hover,
.bcd-thread__link:hover {
  text-decoration: underline;
}
</style>
