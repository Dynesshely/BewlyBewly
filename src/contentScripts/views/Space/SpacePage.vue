<script setup lang="ts">
/**
 * 空间页（自绘）的页面壳。
 *
 * 由 mount.ts 以「自挂载覆盖层」的方式挂在原生空间页之上（原生 DOM 已被它隐藏），
 * 所以这里拿到的一切都是挂载时预取好的快照（props），不再读原生 DOM：
 *   - upInfo：/x/space/wbi/acc/info（UP 信息）；
 *   - initialVideos / initialTotal：/x/space/wbi/arc/search 第一页（默认「最新发布」）；
 *   - relationStat：/x/relation/stat（可为 null，失败时只是不显示粉丝数）。
 *
 * 排序 tab 切换只改内部状态并让网格重拉第 1 页（不整页跳转，也不改地址栏 ——
 * 原生空间页的排序本来就不进 URL）。
 */
import type { SpaceSortId } from './constants'
import type { ArcSearchItem, SpaceRelationStatResult, SpaceUpInfo } from './types'
import BackToTopButton from '~/components/BackToTopButton/BackToTopButton.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useBackToTopButton } from '~/composables/useBackToTopButton'
import { useDrawnPageKeyboardNav } from '~/composables/useDrawnPageKeyboardNav'
import { numFormatter } from '~/utils/dataFormatter'
import SpaceProfileCard from './components/SpaceProfileCard.vue'
import SpaceVideoGrid from './components/SpaceVideoGrid.vue'
import { DEFAULT_SPACE_SORT } from './constants'
import { useSpaceI18n } from './i18n'

const props = defineProps<{
  mid: number
  upInfo: SpaceUpInfo
  initialVideos: ArcSearchItem[]
  initialTotal: number
  relationStat: SpaceRelationStatResult
}>()

const { t } = useSpaceI18n()
const { handleBackToTop } = useBewlyApp()

/** 传给卡片的 UP 最小信息（arc/search 不返回头像，用这里的兜底） */
const upBrief = computed(() => ({
  mid: props.upInfo.mid,
  name: props.upInfo.name,
  face: props.upInfo.face,
}))

const sort = ref<SpaceSortId>(DEFAULT_SPACE_SORT)
const gridRef = ref<InstanceType<typeof SpaceVideoGrid> | null>(null)

/** 排序 tab 的三项（顺序与原生「最新发布 / 最多播放 / 最多收藏」一致） */
const sortOptions = computed(() => [
  { id: 'pubdate' as SpaceSortId, label: t.value.sortLatest },
  { id: 'click' as SpaceSortId, label: t.value.sortPlay },
  { id: 'stow' as SpaceSortId, label: t.value.sortFav },
])

/**
 * 「N 个视频」：优先用接口给的总投稿数（initialTotal），
 * 接口没给时退化为当前已加载条数，避免显示成 0。
 */
const totalText = computed(() => {
  const count = props.initialTotal > 0
    ? props.initialTotal
    : props.initialVideos.length
  return t.value.videoCount.replace('{count}', numFormatter(count).trim())
})

// #region 键盘导航（J / K / ↑ / ↓ / Enter / Esc / Home / End）
//
// 注册表（constants/shortcutRegistry 的 space scope）早就登记了这四个动作，
// 命令面板和 ? 帮助也把「当前页可用」标出来了，但此前没有任何实现（真机按 J/K 无反应）。
const pageNav = useDrawnPageKeyboardNav()

// 卡片网格由 SpaceVideoGrid 渲染，列表刷新后高亮下标可能越界 → 收敛
watch(() => sort.value, () => pageNav.reconcile())
// #endregion

/**
 * 切排序：重置网格并重拉第 1 页。
 *
 * 排序显式传给网格（`reload(sort)`），不能只改 sort.value 再让网格读 props ——
 * 本组件与网格的 props 更新都在下一拍，网格立刻发的请求会拿到旧排序。
 */
function selectSort(next: SpaceSortId) {
  if (next === sort.value)
    return
  sort.value = next
  // 新排序是另一份列表，停在原滚动位置会让人以为内容没变
  handleBackToTop()
  // 换排序后旧高亮就不再指向「刚看的那张」了，清掉避免误导
  pageNav.clear()
  void gridRef.value?.reload(next)
}

// #region 回到顶部 / 底部
//
// 空间页是无限滚动列表，滚过两屏就想回顶是高频动作；此前这一页没有回顶按钮。
const { showTop, showBottom, scrollToTop, scrollToBottom } = useBackToTopButton({ withBottom: true })
// #endregion
</script>

<template>
  <div class="space-drawn-page" :data-bewly-space-drawn="mid">
    <SpaceProfileCard :up-info="upInfo" :relation-stat="relationStat" />

    <div class="space-sort" role="tablist" :aria-label="t.sortAria">
      <button
        v-for="option in sortOptions"
        :key="option.id"
        class="space-sort__tab"
        :class="{ 'is-active': option.id === sort }"
        type="button"
        role="tab"
        :aria-selected="option.id === sort"
        @click="selectSort(option.id)"
      >
        {{ option.label }}
      </button>
      <span class="space-sort__count">{{ totalText }}</span>
    </div>

    <SpaceVideoGrid
      ref="gridRef"
      :mid="mid"
      :sort="sort"
      :initial="initialVideos"
      :initial-total="initialTotal"
      :up="upBrief"
    />

    <BackToTopButton
      :show-top="showTop"
      :show-bottom="showBottom"
      @top="scrollToTop"
      @bottom="scrollToBottom"
    />
  </div>
</template>
