<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Video } from '../types'

import { useI18n } from 'vue-i18n'
import { useBewlyApp } from '~/composables/useAppProvider'
import { Type as ThreePointV2Type } from '~/models/video/appForYou'
import { openLinkToNewTab } from '~/utils/main'

import { openLinkInBackground } from '~/utils/tabs'
import DislikeDialog from './components/DislikeDialog.vue'

const props = defineProps<{
  video: Video
  contextMenuStyles: CSSProperties
}>()
const emit = defineEmits<{
  (event: 'removed', selectedOpt?: { dislikeReasonId: number }): void
  (event: 'close'): void
  (event: 'reopen'): void
}>()

const getVideoType = inject<() => string>('getVideoType')!

const { t } = useI18n()

/** 「不感兴趣 / 不想看此 UP 主」跟随界面语言，语言切换后立即更新 */
const videoOptions = computed<{ id: number, name: string }[]>(() => [
  {
    id: 1,
    name: t('video_card.operation.not_interested'),
  },
  {
    id: 2,
    name: t('video_card.operation.hide_uploader'),
  },
])
const showContextMenu = ref<boolean>(false)
const menuRef = ref<HTMLElement | null>(null)
/** 关闭菜单后要把焦点还回去的卡片元素 */
let cardFocusTarget: HTMLElement | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

/** 菜单项（role=menuitem，键盘 ↑↓ 在它们之间移动） */
function menuItems(): HTMLElement[] {
  const root = menuRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('.context-menu-item'))
    .filter(el => el.getClientRects().length > 0)
}

function focusMenuItem(backward: boolean): void {
  const items = menuItems()
  if (!items.length)
    return
  const active = activeElementDeep()
  const current = active
    ? items.indexOf(active)
    : -1
  const next = current < 0
    ? (backward
        ? items.length - 1
        : 0)
    : (current + (backward
        ? -1
        : 1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
}

/** 键盘可达：↑↓ / Home / End 移动，Enter 执行当前项，Esc 关闭 */
function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleClose()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    event.stopPropagation()
    focusMenuItem(false)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    focusMenuItem(true)
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    event.stopPropagation()
    const items = menuItems()
    const target = event.key === 'Home'
      ? items[0]
      : items[items.length - 1]
    target?.focus({ preventScroll: true })
    return
  }
  if (event.key === 'Enter') {
    const active = activeElementDeep()
    if (active && active.classList.contains('context-menu-item')) {
      event.preventDefault()
      event.stopPropagation()
      active.click()
    }
  }
}
const showDislikeDialog = ref<boolean>(false)
const showPipWindow = ref<boolean>(false)
const { openIframeDrawer } = useBewlyApp()

enum VideoOption {
  OpenInNewTab,
  OpenInBackground,
  OpenInCurrentTab,
  OpenInNewWindow,
  OpenInDrawer,

  ViewTheOriginalCover,
  ViewThisUserChannel,

  CopyVideoLink,
  CopyBVNumber,
  CopyAVNumber,
}

const commonOptions = computed((): { command: VideoOption, name: string, icon: string, color?: string }[][] => {
  let result = [
    [
      {
        command: VideoOption.OpenInNewTab,
        name: t('video_card.operation.open_in_new_tab'),
        icon: 'i-solar:square-top-down-bold-duotone',
      },
      {
        command: VideoOption.OpenInBackground,
        name: t('video_card.operation.open_in_background'),
        icon: 'i-solar:square-top-down-bold-duotone',
      },
      {
        command: VideoOption.OpenInNewWindow,
        name: t('video_card.operation.open_in_new_window'),
        icon: 'i-solar:maximize-square-3-bold-duotone',
      },
      {
        command: VideoOption.OpenInCurrentTab,
        name: t('video_card.operation.open_in_current_tab'),
        icon: 'i-solar:square-top-down-bold-duotone',
      },
      {
        command: VideoOption.OpenInDrawer,
        name: t('video_card.operation.open_in_drawer'),
        icon: 'i-solar:archive-up-minimlistic-bold-duotone',
      },
    ],

    [
      {
        command: VideoOption.CopyVideoLink,
        name: t('video_card.operation.copy_video_link'),
        icon: 'i-solar:copy-bold-duotone',
      },
      {
        command: VideoOption.CopyBVNumber,
        name: t('video_card.operation.copy_bv_number'),
        icon: 'i-solar:copy-bold-duotone',
      },
      {
        command: VideoOption.CopyAVNumber,
        name: t('video_card.operation.copy_av_number'),
        icon: 'i-solar:copy-bold-duotone',
      },
    ],

    [
      {
        command: VideoOption.ViewTheOriginalCover,
        name: t('video_card.operation.view_the_original_cover'),
        icon: 'i-solar:gallery-minimalistic-bold-duotone',
      },
    ],
  ]
  if (getVideoType() === 'bangumi' || getVideoType() === 'live') {
    result = result.map((group) => {
      return group.filter((opt) => {
        return opt.command !== VideoOption.CopyBVNumber && opt.command !== VideoOption.CopyAVNumber && opt.command !== VideoOption.ViewThisUserChannel
      })
    })
  }
  return result
})

onMounted(async () => {
  showContextMenu.value = true
  await nextTick()
  // 关闭后焦点回卡片：优先卡片里的链接（本身可聚焦），退回卡片根节点
  const card = menuRef.value?.closest('[data-video-card]') as HTMLElement | null
  cardFocusTarget = card?.querySelector<HTMLElement>('a[href]') ?? card ?? activeElementDeep()
  const items = menuItems()
  items[0]?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  if (cardFocusTarget?.isConnected)
    cardFocusTarget.focus({ preventScroll: true })
  cardFocusTarget = null
})

function handleMoreCommand(_command: number) {
  handleRemoved()
}

function handleAppMoreCommand(command: ThreePointV2Type) {
  switch (command) {
    case ThreePointV2Type.Feedback:
      break
    case ThreePointV2Type.Dislike:
      openAppDislikeDialog()
      break
  }
}

function handleCommonCommand(command: VideoOption) {
  switch (command) {
    case VideoOption.OpenInNewTab:
      openLinkToNewTab(props.video.url!)
      handleClose()
      break
    case VideoOption.OpenInBackground:
      openLinkInBackground(props.video.url!)
      handleClose()
      break
    case VideoOption.OpenInNewWindow:
      showPipWindow.value = true
      break
    case VideoOption.OpenInCurrentTab:
      window.open(props.video.url, '_self')
      handleClose()
      break
    case VideoOption.OpenInDrawer:
      openIframeDrawer(props.video.url || '')
      handleClose()
      break

    case VideoOption.CopyVideoLink:
      navigator.clipboard.writeText(props.video.url!)
      handleClose()
      break
    case VideoOption.CopyBVNumber:
      navigator.clipboard.writeText(props.video.bvid!)
      handleClose()
      break
    case VideoOption.CopyAVNumber:
      navigator.clipboard.writeText(`av${props.video.id.toString()}`)
      handleClose()
      break

    case VideoOption.ViewTheOriginalCover:
      window.open(props.video.cover, '_blank')
      handleClose()
      break
  }
}

function openAppDislikeDialog() {
  showDislikeDialog.value = true
  showContextMenu.value = false
}

function handleClose() {
  showContextMenu.value = false
  showPipWindow.value = false
  emit('close')
}

function handleReopen() {
  // showContextMenu.value = false
  // showPipWindow.value = false
  // console.log('reopen')
  // emit('reopen')
  handleClose()
}

function handleRemoved(selectedOpt?: { dislikeReasonId: number }) {
  emit('removed', selectedOpt)
  handleClose()
}
</script>

<template>
  <div>
    <!-- more popup -->
    <div v-if="showContextMenu">
      <div
        ref="menuRef"
        role="menu"
        style="backdrop-filter: var(--bew-filter-glass-1); box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);"
        :style="contextMenuStyles"
        p-1
        bg="$bew-elevated" rounded="$bew-radius" min-w-200px
        m="t-4 l-[calc(-200px+1rem)]" border="1 $bew-border-color"
        z-10
        @keydown="onMenuKeydown"
      >
        <ul flex="~ col gap-1">
          <template v-if="getVideoType() === 'appRcmd'">
            <template v-for="option in video.threePointV2" :key="option.type">
              <li
                v-if="option.type !== ThreePointV2Type.WatchLater && option.type !== ThreePointV2Type.Feedback"
                class="context-menu-item" role="menuitem" tabindex="-1"
                @click="handleAppMoreCommand(option.type)"
              >
                <i class="item-icon" i-solar:confounded-circle-bold-duotone />
                <span v-if="option.type === ThreePointV2Type.Dislike">{{ $t('video_card.operation.not_interested') }}</span>
                <span v-else>{{ option.title }}</span>
              </li>
            </template>
          </template>
          <template v-else-if="getVideoType() === 'rcmd'">
            <li
              v-for="option in videoOptions" :key="option.id"
              class="context-menu-item" role="menuitem" tabindex="-1"
              @click="handleMoreCommand(option.id)"
            >
              <i class="item-icon" i-solar:confounded-circle-bold-duotone />
              {{ option.name }}
            </li>
          </template>

          <div v-if="getVideoType() === 'rcmd'" class="divider" />

          <template v-for="(optionGroup, index) in commonOptions" :key="index">
            <li
              v-for="option in optionGroup"
              :key="option.command"
              class="context-menu-item" role="menuitem" tabindex="-1"
              @click="handleCommonCommand(option.command)"
            >
              <i class="item-icon" :class="option.icon" />
              {{ option.name }}
            </li>

            <div v-if="index !== commonOptions.length - 1" class="divider" />
          </template>
        </ul>
      </div>
    </div>

    <!-- mask -->
    <div
      v-if="showContextMenu"
      pos="fixed top-0 left-0" w-full h-full
      @click="handleClose"
      @click.right.prevent.stop="handleReopen"
    />

    <DislikeDialog
      v-model="showDislikeDialog"
      :video="video"
      @close="handleClose"
      @removed="handleRemoved"
    />

    <PipWindow
      v-if="showPipWindow"
      :url="video.url"
      @close="handleClose"
    />
  </div>
</template>

<style lang="scss" scoped>
.context-menu-item {
  --uno: "hover:bg-$bew-fill-2 text-sm px-2.5 py-1.75 rounded-$bew-radius-half cursor-pointer";
  --uno: "flex items-center";
}

.context-menu-item:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: -2px;
  background: var(--bew-fill-2);
}

.item-icon {
  --uno: "mr-2 inline-block color-$bew-text-color-2";
}

.divider {
  --uno: "w-full h-1px px-2px bg-$bew-border-color";
}
</style>
