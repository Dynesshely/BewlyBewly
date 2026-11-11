<script setup lang="ts">
import type { ListCategoryChip } from '../types'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useListI18n } from '../i18n'

/**
 * 收藏夹分类胶囊（收藏页）。
 *
 * 第 21 轮起支持管理操作：
 * - 每个胶囊右侧「更多」按钮 → 菜单（重命名 / 删除）；删除有二次确认；
 * - 行末「+ 新建收藏夹」行内输入（Enter 提交 / Esc 取消 / 空标题禁用）；
 * - 键盘可达：胶囊与「更多」都是原生 button；菜单 `role="menu"` + 菜单项 `role="menuitem"`，
 *   ↑↓ / Home / End 循环、Enter 执行、Esc 关闭并把焦点还给「更多」按钮；
 * - 菜单 / 确认框 / 新建输入打开时用第 19/20 轮同一套焦点陷阱（getRootNode() 捕获 + preventDefault +
 *   activeElementDeep），Tab 不会跑出当前弹层；
 * - 所有写操作由父级（Favorites.vue）执行：本组件只发事件 + 用 pending props 禁用交互，
 *   失败时父级不改数据，输入内容自然保留。
 */
const props = withDefaults(defineProps<{
  categories: ListCategoryChip[]
  selectedId?: number
  /** 是否显示管理操作（仅收藏页开启；历史 / 稍后再看不传） */
  manageable?: boolean
  /** 正在执行写操作的收藏夹 id（禁用该胶囊交互） */
  pendingId?: number | null
  /** 「+ 新建收藏夹」请求在途 */
  createPending?: boolean
}>(), {
  selectedId: undefined,
  manageable: false,
  pendingId: null,
  createPending: false,
})

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'rename', id: number, title: string): void
  (e: 'delete', id: number): void
  (e: 'create', title: string): void
}>()

const { tl } = useListI18n()

/** 当前打开菜单的胶囊 id */
const menuOpenId = ref<number | null>(null)
/** 当前展开删除确认的胶囊 id */
const confirmId = ref<number | null>(null)
/** 当前正在重命名的胶囊 id */
const renamingId = ref<number | null>(null)
const renameDraft = ref<string>('')
/** 是否展开「+ 新建收藏夹」输入 */
const creating = ref<boolean>(false)
const createDraft = ref<string>('')

const menuRef = ref<HTMLElement | null>(null)
const confirmRef = ref<HTMLElement | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)
const createInputRef = ref<HTMLInputElement | null>(null)
const createTriggerRef = ref<HTMLElement | null>(null)
const moreButtonRefs = new Map<number, HTMLElement>()
let trappedRoot: ShadowRoot | Document | null = null
/** 删除确认的目标 id（确认框收起后用于把焦点还给「更多」按钮） */
let tmpDeleteId: number | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

function isBusy(id: number): boolean {
  return props.pendingId === id
}

/** 当前弹层里真实可聚焦元素（隐藏 / 禁用 / tabindex=-1 的不算） */
function trapFocusables(): HTMLElement[] {
  const root = menuOpenId.value !== null
    ? menuRef.value
    : (confirmId.value !== null
        ? confirmRef.value
        : null)
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

function moveFocusInTrap(backward: boolean): void {
  const items = trapFocusables()
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

/** 捕获阶段拦下 Tab：必须 preventDefault，否则默认行为会把焦点移出弹层 */
function onTrapKeydown(event: Event): void {
  if (!(event instanceof KeyboardEvent))
    return
  if (event.key === 'Tab') {
    event.preventDefault()
    event.stopPropagation()
    moveFocusInTrap(event.shiftKey)
  }
}

function bindTrap(root: HTMLElement | null): void {
  unbindTrap()
  const node = root?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document) {
    trappedRoot = node
    node.addEventListener('keydown', onTrapKeydown, true)
  }
}

function unbindTrap(): void {
  if (trappedRoot) {
    trappedRoot.removeEventListener('keydown', onTrapKeydown, true)
    trappedRoot = null
  }
}

/** 点击弹层外部（含其它胶囊）时关闭菜单 / 取消删除确认 */
function handleOutsidePointer(event: Event): void {
  if (menuOpenId.value === null && confirmId.value === null)
    return
  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  const activeRoot = menuOpenId.value !== null
    ? menuRef.value
    : confirmRef.value
  if (activeRoot && path.includes(activeRoot))
    return
  if (menuOpenId.value !== null)
    closeMenu(false)
  if (confirmId.value !== null)
    cancelDelete(false)
}

function closeMenu(restoreFocus = true): void {
  if (menuOpenId.value === null)
    return
  const id = menuOpenId.value
  menuOpenId.value = null
  unbindTrap()
  if (restoreFocus)
    moreButtonRefs.get(id)?.focus({ preventScroll: true })
}

function toggleMenu(id: number): void {
  if (isBusy(id))
    return
  if (menuOpenId.value === id) {
    closeMenu()
    return
  }
  closeMenu(false)
  cancelDelete(false)
  menuOpenId.value = id
  nextTick(() => {
    bindTrap(menuRef.value)
    trapFocusables()[0]?.focus({ preventScroll: true })
  })
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'ArrowLeft') {
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    moveFocusInTrap(event.key === 'ArrowUp')
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    event.stopPropagation()
    const items = trapFocusables()
    const target = event.key === 'Home'
      ? items[0]
      : items[items.length - 1]
    target?.focus({ preventScroll: true })
  }
}

function select(id: number): void {
  if (isBusy(id) || renamingId.value !== null || creating.value || menuOpenId.value !== null || confirmId.value !== null)
    return
  emit('select', id)
}

function startRename(category: ListCategoryChip): void {
  if (isBusy(category.id))
    return
  closeMenu(false)
  cancelDelete(false)
  renamingId.value = category.id
  renameDraft.value = category.title
  cancelCreate()
  void nextTick(() => {
    renameInputRef.value?.focus({ preventScroll: true })
    renameInputRef.value?.select()
  })
}

function cancelRename(): void {
  const id = renamingId.value
  renamingId.value = null
  renameDraft.value = ''
  if (id !== null)
    moreButtonRefs.get(id)?.focus({ preventScroll: true })
}

function submitRename(): void {
  const id = renamingId.value
  const title = renameDraft.value.trim()
  if (id === null || !title || isBusy(id))
    return
  emit('rename', id, title)
}

function askDelete(category: ListCategoryChip): void {
  if (isBusy(category.id))
    return
  closeMenu(false)
  tmpDeleteId = category.id
  confirmId.value = category.id
  void nextTick(() => {
    bindTrap(confirmRef.value)
    // 默认聚焦「取消」，避免回车误删
    const buttons = trapFocusables()
    buttons[buttons.length - 1]?.focus({ preventScroll: true })
  })
}

function cancelDelete(restoreFocus = true): void {
  const id = confirmId.value ?? tmpDeleteId
  confirmId.value = null
  tmpDeleteId = null
  unbindTrap()
  if (restoreFocus && id !== null)
    moreButtonRefs.get(id)?.focus({ preventScroll: true })
}

function confirmDelete(): void {
  const id = confirmId.value
  if (id === null || isBusy(id))
    return
  const target = id
  confirmId.value = null
  tmpDeleteId = null
  unbindTrap()
  moreButtonRefs.get(target)?.focus({ preventScroll: true })
  emit('delete', target)
}

function startCreate(): void {
  if (props.createPending)
    return
  closeMenu(false)
  cancelDelete(false)
  renamingId.value = null
  creating.value = true
  createDraft.value = ''
  void nextTick(() => createInputRef.value?.focus({ preventScroll: true }))
}

function cancelCreate(): void {
  if (!creating.value)
    return
  creating.value = false
  createDraft.value = ''
  void nextTick(() => createTriggerRef.value?.focus({ preventScroll: true }))
}

function submitCreate(): void {
  const title = createDraft.value.trim()
  if (!title || props.createPending)
    return
  emit('create', title)
}

function setMoreButtonRef(id: number, el: unknown): void {
  if (el instanceof HTMLElement)
    moreButtonRefs.set(id, el)
  else
    moreButtonRefs.delete(id)
}

/** 数据刷新（成功写操作后父级会替换数组）→ 收起输入与菜单；失败时父级不改数据，输入保留 */
watch(() => props.categories, () => {
  if (renamingId.value !== null && !props.pendingId)
    cancelRenameWithoutFocus()
  if (creating.value && !props.createPending) {
    creating.value = false
    createDraft.value = ''
  }
})

function cancelRenameWithoutFocus(): void {
  renamingId.value = null
  renameDraft.value = ''
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer, true)
  unbindTrap()
})
</script>

<template>
  <nav v-if="categories.length || manageable" class="bewly-list-chips" :aria-label="tl('favorites.categories')">
    <div
      v-for="category in categories"
      :key="category.id"
      class="bewly-list-chip-wrap"
      :class="{ 'is-editing': renamingId === category.id }"
    >
      <template v-if="renamingId === category.id">
        <input
          ref="renameInputRef"
          v-model="renameDraft"
          class="bewly-list-chip__input"
          type="text"
          maxlength="40"
          :placeholder="tl('favorites.rename_placeholder')"
          :aria-label="tl('favorites.rename_placeholder')"
          :disabled="isBusy(category.id)"
          @keydown.enter.prevent="submitRename"
          @keydown.esc.prevent.stop="cancelRename"
        >
      </template>
      <template v-else>
        <button
          type="button"
          class="bewly-list-chip"
          :class="{ 'is-active': category.id === selectedId }"
          :aria-pressed="category.id === selectedId"
          :title="category.title"
          :disabled="isBusy(category.id)"
          @click="select(category.id)"
        >
          <span class="bewly-list-chip__title">{{ category.title }}</span>
          <span v-if="typeof category.count === 'number'" class="bewly-list-chip__count">{{ category.count }}</span>
        </button>

        <button
          v-if="manageable"
          :ref="el => setMoreButtonRef(category.id, el)"
          type="button"
          class="bewly-list-chip__more"
          :aria-label="tl('favorites.manage_named', { name: category.title })"
          aria-haspopup="menu"
          :aria-expanded="menuOpenId === category.id"
          :disabled="isBusy(category.id)"
          @click.stop="toggleMenu(category.id)"
        >
          <span class="i-mingcute:more-2-line" aria-hidden="true" />
        </button>
      </template>

      <div
        v-if="menuOpenId === category.id"
        ref="menuRef"
        class="bewly-list-chip__menu"
        role="menu"
        :aria-label="tl('favorites.manage')"
        @keydown="onMenuKeydown"
      >
        <button
          type="button"
          class="bewly-list-chip__menu-item"
          role="menuitem"
          tabindex="-1"
          @click="startRename(category)"
        >
          {{ tl('favorites.rename') }}
        </button>
        <button
          type="button"
          class="bewly-list-chip__menu-item is-danger"
          role="menuitem"
          tabindex="-1"
          @click="askDelete(category)"
        >
          {{ tl('favorites.delete') }}
        </button>
      </div>

      <div
        v-if="confirmId === category.id"
        ref="confirmRef"
        class="bewly-list-chip__confirm"
        role="alertdialog"
        aria-modal="false"
        :aria-label="tl('favorites.delete_confirm_title', { name: category.title })"
      >
        <p class="bewly-list-chip__confirm-title">
          {{ tl('favorites.delete_confirm_title', { name: category.title }) }}
        </p>
        <p class="bewly-list-chip__confirm-desc">
          {{ tl('favorites.delete_confirm_desc') }}
        </p>
        <div class="bewly-list-chip__confirm-actions">
          <button
            type="button"
            class="bewly-list-chip__confirm-btn is-danger"
            :disabled="isBusy(category.id)"
            @click="confirmDelete"
          >
            {{ tl('favorites.delete') }}
          </button>
          <button
            type="button"
            class="bewly-list-chip__confirm-btn"
            :disabled="isBusy(category.id)"
            @click="cancelDelete()"
          >
            {{ tl('favorites.cancel') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="creating" class="bewly-list-chip-wrap is-creating">
      <input
        ref="createInputRef"
        v-model="createDraft"
        class="bewly-list-chip__input"
        type="text"
        maxlength="40"
        :placeholder="tl('favorites.create_placeholder')"
        :aria-label="tl('favorites.create_placeholder')"
        :disabled="createPending"
        @keydown.enter.prevent="submitCreate"
        @keydown.esc.prevent.stop="cancelCreate"
      >
      <button
        type="button"
        class="bewly-list-chip__mini is-primary"
        :disabled="createPending || !createDraft.trim()"
        @click="submitCreate"
      >
        {{ createPending ? tl('favorites.saving') : tl('favorites.create') }}
      </button>
      <button
        type="button"
        class="bewly-list-chip__mini"
        :disabled="createPending"
        @click="cancelCreate"
      >
        {{ tl('favorites.cancel') }}
      </button>
    </div>

    <button
      v-else-if="manageable"
      ref="createTriggerRef"
      type="button"
      class="bewly-list-chip is-create"
      :disabled="createPending"
      @click="startCreate"
    >
      <span class="i-mingcute:add-line" aria-hidden="true" />
      {{ tl('favorites.create') }}
    </button>
  </nav>
</template>

<style scoped lang="scss">
.bewly-list-chip-wrap {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
}

.bewly-list-chip__more {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 14px;
  color: var(--bew-text-3);
  cursor: pointer;
  background: var(--bew-fill-1);
  border: 1px solid transparent;
  border-radius: 10px;
  place-items: center;
  transition:
    background-color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    color 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.bewly-list-chip__more:hover {
  color: var(--bew-text-1);
  background: var(--bew-fill-2);
}

.bewly-list-chip__more:focus-visible,
.bewly-list-chip__menu-item:focus-visible,
.bewly-list-chip__confirm-btn:focus-visible,
.bewly-list-chip__mini:focus-visible,
.bewly-list-chip__input:focus-visible,
.bewly-list-chip.is-create:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.bewly-list-chip__more:disabled,
.bewly-list-chip__mini:disabled,
.bewly-list-chip__confirm-btn:disabled,
.bewly-list-chip__input:disabled {
  cursor: progress;
  opacity: 0.6;
}

.bewly-list-chip.is-create {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--bew-text-2);
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--bew-border-color);
  border-radius: 10px;
}

.bewly-list-chip.is-create:hover {
  color: var(--bew-theme-color);
  border-color: var(--bew-theme-color-40);
  background: var(--bew-theme-color-20);
}

.bewly-list-chip__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-width: 128px;
  padding: 4px;
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: var(--bew-shadow-2);
}

.bewly-list-chip__menu-item {
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.bewly-list-chip__menu-item:hover {
  background: var(--bew-fill-1);
}

.bewly-list-chip__menu-item.is-danger {
  color: var(--bew-error-color);
}

.bewly-list-chip__confirm {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 236px;
  padding: 10px;
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: var(--bew-shadow-2);
}

.bewly-list-chip__confirm-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
}

.bewly-list-chip__confirm-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.bewly-list-chip__confirm-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 2px;
}

.bewly-list-chip__confirm-btn {
  padding: 3px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-2);
  cursor: pointer;
  background: var(--bew-fill-1);
  border: 1px solid transparent;
  border-radius: 8px;
}

.bewly-list-chip__confirm-btn.is-danger {
  color: var(--bew-error-color);
  background: var(--bew-error-color-10);
}

.bewly-list-chip__mini {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: var(--bew-text-2);
  cursor: pointer;
  background: var(--bew-fill-1);
  border: 1px solid transparent;
  border-radius: 10px;
}

.bewly-list-chip__mini.is-primary {
  color: #fff;
  background: var(--bew-theme-color);
}

.bewly-list-chip__input {
  width: 140px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .bewly-list-chip__more {
    transition: none;
  }
}

/* #region 暗色 / 高对比度 */
.dark .bewly-list-chip__more {
  color: var(--bew-text-2);
}

@media (prefers-contrast: more) {
  .bewly-list-chip__more,
  .bewly-list-chip__input,
  .bewly-list-chip__menu,
  .bewly-list-chip__confirm,
  .bewly-list-chip__confirm-btn,
  .bewly-list-chip.is-create {
    border-color: var(--bew-text-3);
  }

  .bewly-list-chip__confirm-desc {
    color: var(--bew-text-2);
  }
}
/* #endregion */
</style>
