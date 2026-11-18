<script setup lang="ts">
/**
 * 动态卡片：头像 40 圆 / 昵称 / 时间 / 正文 / 展开折叠 / 图片网格 / 转发引用块 /
 * 视频卡 / 操作栏。
 *
 * # 操作栏为什么不自己调点赞接口
 *
 * 真机把 `POST /x/dynamic/feed/dyn/thumb` 的三种参数组合都试了一遍
 * （`dyn_type` 传 `DYNAMIC_TYPE_AV` 字符串 / 传 1 / 只传 `dyn_id_str` + `csrf`），
 * **全部返回 `4100001 参数错误`** —— 这个接口还需要一套页面侧的隐藏参数
 * （spmid / from_spmid 之类），没有稳定的公开签名。既然自绘层不该伪造交互，
 * 操作栏统一做成「跳转到原生动态详情页」：点赞 / 评论 / 转发在原生页里
 * 都是完整可用的，用户不会被一个点了没反应的按钮骗到。
 *
 * # 折叠
 *
 * 正文超过 6 行折叠，展开 / 收起按钮由 `DynamicText` 自己测量决定。
 */
import type { DynamicItem } from '../types'
import { computed } from 'vue'
import Picture from '~/components/Picture.vue'
import { useDynamicI18n } from '../i18n'
import DynamicActionIcon from './DynamicActionIcon.vue'
import DynamicContent from './DynamicContent.vue'
import DynamicQuote from './DynamicQuote.vue'
import DynamicText from './DynamicText.vue'

const props = defineProps<{
  item: DynamicItem
}>()

const { t, format } = useDynamicI18n()

/** 操作栏三项：数量为空时不显示数字（原生行为） */
const actions = computed(() => [
  {
    type: 'forward' as const,
    icon: 'forward' as const,
    count: props.item.stats.forward,
    label: t.value.forward,
  },
  {
    type: 'comment' as const,
    icon: 'comment' as const,
    count: props.item.stats.comment,
    label: t.value.comment,
  },
  {
    type: 'like' as const,
    icon: 'like' as const,
    count: props.item.stats.like,
    label: props.item.stats.liked ? t.value.liked : t.value.like,
    liked: props.item.stats.liked,
  },
])

function actionAria(label: string): string {
  return format(t.value.actionAria, { name: props.item.authorName, action: label })
}
</script>

<template>
  <article class="dynamic-card" :data-dynamic-id="item.id">
    <header class="dynamic-card__header">
      <a
        class="dynamic-card__avatar"
        :href="item.authorHref || undefined"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="item.authorName"
      >
        <Picture
          v-if="item.authorFace"
          :src="item.authorFace"
          fallback-kind="avatar"
          :alt="item.authorName"
        />
        <span v-else class="dynamic-card__avatar-fallback" aria-hidden="true">
          {{ item.authorName.slice(0, 1) }}
        </span>
        <img
          v-if="item.pendant"
          class="dynamic-card__pendant"
          :src="item.pendant"
          alt=""
          loading="lazy"
          decoding="async"
        >
      </a>

      <div class="dynamic-card__meta">
        <div class="dynamic-card__name-row">
          <a
            class="dynamic-card__name"
            :href="item.authorHref || undefined"
            target="_blank"
            rel="noopener noreferrer"
          >{{ item.authorName }}</a>
          <span v-if="item.vipLabel" class="dynamic-card__badge dynamic-card__badge--vip">
            {{ item.vipLabel }}
          </span>
          <span
            v-if="item.official"
            class="dynamic-card__badge"
            :title="item.official"
          >{{ item.official }}</span>
        </div>
        <div class="dynamic-card__time-row">
          <a
            class="dynamic-card__time"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            :title="t.openDetail"
          >{{ item.time }}</a>
          <a
            v-if="item.topic"
            class="dynamic-card__topic"
            :href="item.topicHref || item.href"
            target="_blank"
            rel="noopener noreferrer"
            :title="t.topic"
          >{{ item.topic }}</a>
        </div>
      </div>
    </header>

    <div class="dynamic-card__body">
      <DynamicText
        v-for="(paragraph, index) in item.paragraphs"
        :key="`card-text-${index}`"
        :paragraph="paragraph"
      />
      <DynamicContent v-if="item.content" :content="item.content" />
      <DynamicQuote v-if="item.quote" :quote="item.quote" />
    </div>

    <footer class="dynamic-card__actions">
      <a
        v-for="action in actions"
        :key="action.type"
        class="dynamic-card__action"
        :class="{ 'is-liked': action.type === 'like' && action.liked }"
        :href="item.href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="actionAria(action.label)"
        :title="actionAria(action.label)"
      >
        <DynamicActionIcon :name="action.icon" />
        <span v-if="action.count" class="dynamic-card__action-count">{{ action.count }}</span>
      </a>
    </footer>
  </article>
</template>
