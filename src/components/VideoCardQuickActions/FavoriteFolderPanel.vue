<script setup lang="ts">
import type { FavoriteFolderOption } from './favoriteFolders'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useQuickActionsMessages } from './i18n'

const props = defineProps<{
  open: boolean
  folders: FavoriteFolderOption[]
  selectedIds: number[]
  loading: boolean
  failed: boolean
  pending: boolean
  /** 「+ 新建收藏夹」请求在途 */
  createPending?: boolean
  /** 最近一次成功创建的收藏夹 id（变化时收起输入框） */
  createdFolderId?: number | null
}>()

const emit = defineEmits<{
  (e: 'toggleFolder', id: number): void
  (e: 'submit'): void
  (e: 'close'): void
  (e: 'retry'): void
  (e: 'create', title: string): void
}>()

const messages = useQuickActionsMessages()
const panelRef = ref<HTMLElement | null>(null)

/** 行内新建收藏夹表单是否展开 */
const creating = ref<boolean>(false)
const draftTitle = ref<string>('')
const titleInputRef = ref<HTMLInputElement | null>(null)

/** 打开面板前的焦点，关闭时还回去（通常是收藏按钮） */
let restoreFocusTo: HTMLElement | null = null
let trappedRoot: ShadowRoot | Document | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

/** 面板内真实可聚焦元素（排除隐藏 / 禁用 / tabindex=-1） */
function panelFocusables(): HTMLElement[] {
  const root = panelRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

/** 焦点在面板内循环；没有可聚焦元素时聚焦面板容器（tabindex=-1） */
function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables()
  if (!items.length) {
    panelRef.value?.focus({ preventScroll: true })
    return
  }
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

/** 捕获阶段拦下 Tab：必须 preventDefault，否则浏览器默认行为会把焦点移出面板 */
function onTabCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Tab')
    return
  event.preventDefault()
  event.stopPropagation()
  moveFocusInPanel(event.shiftKey)
}

/** 面板在 #bewly 的 shadow root 里：监听挂到所在的 ShadowRoot（没有则 Document） */
function bindTabTrap(): void {
  unbindTabTrap()
  const node = panelRef.value?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document) {
    trappedRoot = node
    node.addEventListener('keydown', onTabCapture, true)
  }
}

function unbindTabTrap(): void {
  if (trappedRoot) {
    trappedRoot.removeEventListener('keydown', onTabCapture, true)
    trappedRoot = null
  }
}

/** 关闭面板：收起输入框后把焦点还给打开它的按钮 */
function closePanel(): void {
  creating.value = false
  draftTitle.value = ''
  emit('close')
}

const selectedCountText = computed(() => messages.value.selectedCount.replace('{count}', String(props.selectedIds.length)))
const submitText = computed(() => (props.pending ? messages.value.pending : messages.value.submitFavorite))

const canSubmitCreate = computed(() => !props.createPending && draftTitle.value.trim().length > 0)

function startCreate(): void {
  creating.value = true
  draftTitle.value = ''
  void nextTick(() => titleInputRef.value?.focus())
}

function cancelCreate(): void {
  if (props.createPending)
    return
  creating.value = false
  draftTitle.value = ''
}

function handleEscapeFromInput(): void {
  closePanel()
}

function submitCreate(): void {
  const title = draftTitle.value.trim()
  if (!title || props.createPending)
    return
  emit('create', title)
}

function isSelected(id: number): boolean {
  return props.selectedIds.includes(id)
}

function folderCountText(folder: FavoriteFolderOption): string {
  return messages.value.folderCount.replace('{count}', String(folder.mediaCount))
}

function focusFirstElement() {
  const items = panelFocusables()
  if (items.length)
    items[0]?.focus({ preventScroll: true })
  else
    panelRef.value?.focus({ preventScroll: true })
}

/** 点击面板外部关闭（Shadow DOM 下用 composedPath 判断真实目标） */
function handleDocumentClick(event: MouseEvent) {
  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  if (panelRef.value && path.includes(panelRef.value))
    return
  emit('close')
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!props.open)
    return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closePanel()
  }
}

let attachTimer: ReturnType<typeof setTimeout> | null = null

function detachDocumentClick() {
  if (attachTimer !== null) {
    clearTimeout(attachTimer)
    attachTimer = null
  }
  document.removeEventListener('click', handleDocumentClick)
}

watch(() => props.open, async (open) => {
  if (!open) {
    creating.value = false
    draftTitle.value = ''
    unbindTabTrap()
    restoreFocusTo?.focus?.({ preventScroll: true })
    restoreFocusTo = null
  }
  if (open) {
    restoreFocusTo = activeElementDeep()
    await nextTick()
    bindTabTrap()
    focusFirstElement()
    // 延迟一帧再挂外部点击监听：避免同一次点击在 document 阶段把刚打开的面板关掉
    attachTimer = setTimeout(() => {
      attachTimer = null
      document.addEventListener('click', handleDocumentClick)
    }, 0)
  }
  else {
    detachDocumentClick()
  }
})

// 创建成功（父级刷新列表并回传新夹 id）后收起输入框；失败时保留输入内容便于重试
watch(() => props.createdFolderId, (id, previous) => {
  if (typeof id === 'number' && id > 0 && id !== previous && creating.value) {
    creating.value = false
    draftTitle.value = ''
  }
})

onMounted(() => window.addEventListener('keydown', handleWindowKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  detachDocumentClick()
  unbindTabTrap()
  restoreFocusTo?.focus?.({ preventScroll: true })
  restoreFocusTo = null
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      ref="panelRef"
      class="bewly-fav-panel"
      role="dialog"
      aria-modal="false"
      tabindex="-1"
      :aria-label="messages.panelTitle"
      @click.stop
    >
      <div class="bewly-fav-panel__header">
        <span class="bewly-fav-panel__title">{{ messages.panelTitle }}</span>
        <button
          type="button"
          class="bewly-fav-panel__close"
          :aria-label="messages.closePanel"
          :title="messages.closePanel"
          @click="emit('close')"
        >
          <span class="i-mingcute:close-line" aria-hidden="true" />
        </button>
      </div>

      <p class="bewly-fav-panel__hint">
        {{ messages.panelHint }}
      </p>

      <div class="bewly-fav-panel__body">
        <p v-if="loading" class="bewly-fav-panel__state">
          {{ messages.folderLoading }}
        </p>

        <template v-else-if="failed">
          <p class="bewly-fav-panel__state">
            {{ messages.folderLoadFailed }}
          </p>
          <button type="button" class="bewly-fav-panel__action" @click="emit('retry')">
            {{ messages.folderRetry }}
          </button>
        </template>

        <p v-else-if="!folders.length" class="bewly-fav-panel__state">
          {{ messages.folderEmpty }}
        </p>

        <ul v-else class="bewly-fav-panel__list">
          <li v-for="folder in folders" :key="folder.id">
            <button
              type="button"
              class="bewly-fav-panel__option"
              role="checkbox"
              :aria-checked="isSelected(folder.id)"
              @click="emit('toggleFolder', folder.id)"
            >
              <span class="bewly-fav-panel__box" :class="{ 'is-on': isSelected(folder.id) }" aria-hidden="true">
                <span v-if="isSelected(folder.id)" class="i-mingcute:check-line" />
              </span>
              <span class="bewly-fav-panel__name" :title="folder.title">{{ folder.title }}</span>
              <span v-if="folder.isDefault" class="bewly-fav-panel__tag">{{ messages.folderDefault }}</span>
              <span v-if="folder.isPrivate" class="bewly-fav-panel__tag is-private">{{ messages.folderPrivate }}</span>
              <span class="bewly-fav-panel__count">{{ folderCountText(folder) }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="bewly-fav-panel__create-row">
        <template v-if="creating">
          <input
            ref="titleInputRef"
            v-model="draftTitle"
            class="bewly-fav-panel__input"
            type="text"
            maxlength="40"
            :placeholder="messages.createFolderPlaceholder"
            :aria-label="messages.createFolderPlaceholder"
            :disabled="createPending"
            @keydown.enter.prevent="submitCreate"
            @keydown.esc.prevent.stop="handleEscapeFromInput"
          >
          <button
            type="button"
            class="bewly-fav-panel__action is-primary"
            :disabled="!canSubmitCreate"
            @click="submitCreate"
          >
            {{ createPending ? messages.pending : messages.createFolderSubmit }}
          </button>
          <button
            type="button"
            class="bewly-fav-panel__action"
            :disabled="createPending"
            @click="cancelCreate"
          >
            {{ messages.createFolderCancel }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="bewly-fav-panel__action is-create"
          :disabled="loading || failed"
          @click="startCreate"
        >
          {{ messages.createFolder }}
        </button>
      </div>

      <div class="bewly-fav-panel__footer">
        <span class="bewly-fav-panel__selected">{{ selectedCountText }}</span>
        <button
          type="button"
          class="bewly-fav-panel__action"
          :disabled="pending"
          @click="emit('close')"
        >
          {{ messages.dismiss }}
        </button>
        <button
          type="button"
          class="bewly-fav-panel__action is-primary"
          :disabled="pending || loading || failed || !folders.length"
          @click="emit('submit')"
        >
          {{ submitText }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.bewly-fav-panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 6;
  display: flex;
  flex-direction: column;
  width: 236px;
  max-height: min(340px, 46vh);
  padding: 10px;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: var(--bew-shadow-2);
}

.bewly-fav-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bewly-fav-panel__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.bewly-fav-panel__close {
  display: grid;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 13px;
  color: var(--bew-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  place-items: center;
}

.bewly-fav-panel__close:hover {
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
}

.bewly-fav-panel__close:focus-visible,
.bewly-fav-panel__option:focus-visible,
.bewly-fav-panel__action:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.bewly-fav-panel__hint {
  margin: 4px 0 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.bewly-fav-panel__body {
  min-height: 40px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.bewly-fav-panel__state {
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
  text-align: center;
}

.bewly-fav-panel__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.bewly-fav-panel__option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.bewly-fav-panel__option:hover {
  background: var(--bew-fill-1);
}

.bewly-fav-panel__box {
  display: grid;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  font-size: 11px;
  color: #fff;
  border: 1px solid var(--bew-fill-3);
  border-radius: 4px;
  place-items: center;
}

.bewly-fav-panel__box.is-on {
  background: var(--bew-theme-color);
  border-color: var(--bew-theme-color);
}

.bewly-fav-panel__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bewly-fav-panel__tag {
  flex: 0 0 auto;
  padding: 0 4px;
  font-size: 10px;
  line-height: 15px;
  color: var(--bew-theme-color);
  background: var(--bew-theme-color-20);
  border-radius: 5px;
}

.bewly-fav-panel__tag.is-private {
  color: var(--bew-text-3);
  background: var(--bew-fill-1);
}

.bewly-fav-panel__count {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 10px;
  color: var(--bew-text-3);
  font-variant-numeric: tabular-nums;
}

.bewly-fav-panel__create-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
}

.bewly-fav-panel__create-row > .bewly-fav-panel__action.is-create {
  width: 100%;
  padding: 5px 10px;
  text-align: left;
  border: 1px dashed var(--bew-border-color);
  border-radius: 8px;
  background: transparent;
}

.bewly-fav-panel__create-row > .bewly-fav-panel__action.is-create:hover {
  color: var(--bew-theme-color);
  border-color: var(--bew-theme-color-40);
  background: var(--bew-theme-color-20);
}

.bewly-fav-panel__input {
  flex: 1 1 100px;
  min-width: 0;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
}

.bewly-fav-panel__input::placeholder {
  color: var(--bew-text-3);
}

.bewly-fav-panel__input:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 1px;
}

.bewly-fav-panel__input:disabled {
  opacity: 0.72;
}

.bewly-fav-panel__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--bew-border-color);
}

.bewly-fav-panel__selected {
  margin-right: auto;
  font-size: 11px;
  color: var(--bew-text-3);
}

.bewly-fav-panel__action {
  padding: 3px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-2);
  cursor: pointer;
  background: var(--bew-fill-1);
  border: 1px solid transparent;
  border-radius: 8px;
}

.bewly-fav-panel__action:hover {
  color: var(--bew-text-1);
  background: var(--bew-fill-2);
}

.bewly-fav-panel__action.is-primary {
  color: #fff;
  background: var(--bew-theme-color);
}

.bewly-fav-panel__action.is-primary:hover {
  background: var(--bew-theme-color-80);
}

.bewly-fav-panel__action.is-danger {
  color: var(--bew-error-color);
  background: var(--bew-error-color-10);
}

.bewly-fav-panel__action.is-danger:hover {
  background: var(--bew-error-color-20);
}

.bewly-fav-panel__action:disabled {
  cursor: default;
  opacity: 0.55;
}

/* 第 26 轮：强制色彩下自定义勾选框 / 主按钮 / 面板边框回落到系统色 */
@media (forced-colors: active) {
  .bewly-fav-panel {
    color: CanvasText;
    background: Canvas;
    border: 1px solid CanvasText;
  }

  .bewly-fav-panel__action,
  .bewly-fav-panel__option,
  .bewly-fav-panel__close,
  .bewly-fav-panel__box {
    color: ButtonText;
    background: ButtonFace;
    border: 1px solid ButtonText;
  }

  .bewly-fav-panel__action.is-primary {
    color: Highlight;
    border-color: Highlight;
  }

  .bewly-fav-panel__option:focus-visible,
  .bewly-fav-panel__action:focus-visible,
  .bewly-fav-panel__close:focus-visible {
    outline: 2px solid Highlight;
  }
}

@media (max-width: 420px) {
  .bewly-fav-panel {
    width: min(236px, calc(100vw - 24px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .bewly-fav-panel {
    transition: none;
  }
}

/* #region 暗色 / 高对比度（第 17 轮） */
.dark .bewly-fav-panel__close,
.dark .bewly-fav-panel__hint,
.dark .bewly-fav-panel__state,
.dark .bewly-fav-panel__tag.is-private,
.dark .bewly-fav-panel__count,
.dark .bewly-fav-panel__selected,
.dark .bewly-fav-panel__action {
  color: var(--bew-text-2);
}

@media (prefers-contrast: more) {
  .bewly-fav-panel,
  .bewly-fav-panel__box,
  .bewly-fav-panel__action,
  .bewly-fav-panel__input {
    border-color: var(--bew-text-3);
  }

  .bewly-fav-panel__close,
  .bewly-fav-panel__hint,
  .bewly-fav-panel__state,
  .bewly-fav-panel__tag.is-private,
  .bewly-fav-panel__count,
  .bewly-fav-panel__selected {
    color: var(--bew-text-2);
  }
}
/* #endregion */
</style>
