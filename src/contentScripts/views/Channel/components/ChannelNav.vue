<script setup lang="ts">
/**
 * 一级大分类 pill 行（自绘分区导航）。
 *
 * 数据来自原生 `div.bili-header__channel .channel-items__left`（真机 39 项，
 * 由 `mount.ts` 在接管前读取），读不到时用 `constants.ts` 里同一份 dump 的常量表。
 *
 * 每一项都是**真的 `<a href>`**：不劫持点击、不改 history，直接走原生跳转 ——
 * 这样即使自绘页哪天失效，导航仍然可用；`/v/popular` 之类其它模块接管的页面也不会被抢。
 */
import type { ChannelNavItem } from '../constants'
import { useChannelI18n } from '../i18n'

const props = defineProps<{
  items: ChannelNavItem[]
  /** 当前分区 slug（原生 `.channel-link--current` 或路径解析出来的） */
  current: string | null
}>()

const { t } = useChannelI18n()

const rowRef = ref<HTMLElement | null>(null)

/** 当前项滚入可视区（分区很多时保证高亮 pill 不被藏在横向滚动外面） */
onMounted(() => {
  const row = rowRef.value
  if (!row)
    return
  const active = row.querySelector<HTMLElement>('[aria-current="page"]')
  if (!active)
    return
  const left = active.offsetLeft - row.clientWidth / 2 + active.clientWidth / 2
  row.scrollLeft = Math.max(0, left)
})
</script>

<template>
  <nav ref="rowRef" class="channel-nav" :aria-label="t.navAria">
    <a
      v-for="item in props.items"
      :key="item.slug"
      class="channel-nav__pill"
      :class="{
        'channel-nav__pill--active': item.slug === props.current,
        'channel-nav__pill--pgc': !item.region,
      }"
      :href="item.href"
      :aria-current="item.slug === props.current ? 'page' : undefined"
    >
      <span
        v-if="item.color"
        class="channel-nav__dot"
        :style="{ backgroundColor: item.color }"
        aria-hidden="true"
      />
      {{ item.label }}
    </a>
  </nav>
</template>
