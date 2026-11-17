<script setup lang="ts">
/**
 * 二级分区 tab 行。
 *
 * **真机事实：2026-11 的 `/c/<slug>/` 布局已经没有二级分区入口**
 * （`div.channel-page__head` 里只有分区图标 + `div.channel-name`，
 * 旧的 `/v/douga/mad/` 这类二级分区地址直接 302 回 `/c/douga/`）。
 * 所以父组件只在发现到原生二级入口时才渲染本组件（`v-if="subTabs.length"`），
 * 正常分区页上这一行**整体不出现** —— 不拿常量表伪造二级分区，也不做假的筛选。
 *
 * 保留组件本身是为了两件事：
 *   1. 老版分区页（tv / movie / variety 这批 `.channel-nav-click li`）能自动多一行 tab；
 *   2. B 站以后把二级入口加回来时，自绘页无需改代码即可显示。
 */
import type { SubRegionTab } from '../dom'
import { useChannelI18n } from '../i18n'

const props = defineProps<{
  tabs: SubRegionTab[]
}>()

const { t } = useChannelI18n()
</script>

<template>
  <nav class="channel-subtabs" :aria-label="t.subTabsAria" data-bewly-channel-subtabs>
    <template v-for="tab in props.tabs" :key="`${tab.label}|${tab.href}`">
      <a
        v-if="tab.href"
        class="channel-subtabs__tab"
        :class="{ 'channel-subtabs__tab--active': tab.active }"
        :href="tab.href"
        :aria-current="tab.active ? 'page' : undefined"
      >
        {{ tab.label }}
      </a>
      <span
        v-else
        class="channel-subtabs__tab"
        :class="{ 'channel-subtabs__tab--active': tab.active }"
      >
        {{ tab.label }}
      </span>
    </template>
  </nav>
</template>
