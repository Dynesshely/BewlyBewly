<script setup lang="ts">
/**
 * 正文段落：按富文本节点渲染（@ / 话题 / 视频链接可点），默认折叠 N 行。
 *
 * # 为什么按节点渲染而不是整段纯文本
 *
 * 真机正文里的 `rich_text_nodes` 把 @、话题、表情、视频链接都拆成了独立节点，
 * 各自的 `jump_url` 指向不同页面。整段纯文本渲染会让这些内容全部变成不可点的死字，
 * 与原生动态页的体验差一截。
 *
 * # 表情为什么用内联 `<img>` 而不是 Picture 组件
 *
 * `Picture` 会给 `src` 拼 `.avif` / `.webp` 候选后交给 `<picture>` 兜底；
 * 而表情图是 `…/emote/xxx.png`，真机上 `xxx.png.avif` 是 **404**（实测）。
 * 虽然 `<source>` 失败会退回原 `<img>`，但每条动态多出十几个 404 请求毫无意义，
 * 所以表情直接用原图地址的 `<img>`。
 *
 * # 折叠判据
 *
 * 用 `scrollHeight - clientHeight` 实测判断是否溢出，不按字数猜（中英混排字数与行数
 * 关系不稳定）；`ResizeObserver` 兜住窗口缩放与字体加载完成后的重排。
 */
import type { DynamicParagraph } from '../types'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDynamicI18n } from '../i18n'

const props = withDefaults(defineProps<{
  paragraph: DynamicParagraph
  /** 折叠行数 */
  lines?: number
  /** 是否启用折叠（引用块里的正文不折叠，否则嵌套两层展开按钮很乱） */
  collapsible?: boolean
}>(), {
  lines: 6,
  collapsible: true,
})

const { t } = useDynamicI18n()

const textRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const overflowing = ref(false)
let resizeObserver: ResizeObserver | null = null

function measureOverflow(): void {
  const element = textRef.value
  if (!element || expanded.value || !props.collapsible) {
    overflowing.value = false
    return
  }
  overflowing.value = element.scrollHeight - element.clientHeight > 2
}

onMounted(() => {
  void nextTick(measureOverflow)
  if (textRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureOverflow())
    resizeObserver.observe(textRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(() => props.paragraph, async () => {
  expanded.value = false
  await nextTick()
  measureOverflow()
}, { deep: true })
</script>

<template>
  <div class="dynamic-text-wrap">
    <p
      ref="textRef"
      class="dynamic-text"
      :class="{ 'is-expanded': expanded, 'is-collapsed': collapsible && !expanded }"
      :style="collapsible && !expanded ? { '--dynamic-text-lines': lines } : undefined"
    >
      <template v-for="(node, index) in paragraph.nodes" :key="index">
        <img
          v-if="node.kind === 'emoji' && node.icon"
          class="dynamic-text__emoji"
          :src="node.icon"
          :alt="node.text"
          loading="lazy"
          decoding="async"
        >
        <a
          v-else-if="node.kind === 'link'"
          class="dynamic-text__link"
          :href="node.href"
          target="_blank"
          rel="noopener noreferrer"
        >{{ node.text }}</a>
        <span v-else>{{ node.text }}</span>
      </template>
    </p>
    <button
      v-if="collapsible && overflowing"
      type="button"
      class="dynamic-text__toggle"
      @click="expanded = !expanded"
    >
      {{ expanded ? t.collapse : t.expand }}
    </button>
  </div>
</template>
