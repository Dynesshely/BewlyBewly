<script setup lang="ts">
/**
 * 顶部 tab：私信 / 回复我的 / @ 我的 / 收到的赞 / 系统通知。
 *
 * 顺序与原生左栏完全一致（真机 `.message-sidebar__item` 文案：
 * 我的消息 / 回复我的 / @ 我的 / 收到的赞 / 系统通知 / 消息设置）。
 * 切换 tab 不改地址栏以外的东西：由页面写 hash，mount.ts 的路由监听再把 tab 推回来
 * （与 Search 的「写 URL → historyChange → syncRoute」同一套闭环，靠 isSameTab 短路）。
 */
import type { MessageTabId } from '../constants'
import { MESSAGE_TABS } from '../constants'
import { useMessageDrawnI18n } from '../i18n'

defineProps<{
  active: MessageTabId
  /** 每个 tab 的未读数（0 不显示） */
  badges: Partial<Record<MessageTabId, number>>
}>()

const emit = defineEmits<{ (e: 'change', tab: MessageTabId): void }>()

const { t, tabLabel } = useMessageDrawnI18n()
</script>

<template>
  <nav class="msg-tabs" role="tablist" :aria-label="t.tabsAria">
    <button
      v-for="tab in MESSAGE_TABS"
      :key="tab"
      class="msg-tabs__tab"
      :class="{ 'is-active': tab === active }"
      type="button"
      role="tab"
      :aria-selected="tab === active"
      @click="emit('change', tab)"
    >
      <span class="msg-tabs__label">{{ tabLabel(tab) }}</span>
      <span v-if="badges[tab]" class="msg-tabs__badge" aria-hidden="true">{{ badges[tab] }}</span>
    </button>
  </nav>
</template>
