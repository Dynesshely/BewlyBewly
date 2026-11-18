<script setup lang="ts">
/**
 * 收藏页左侧收藏夹列表（自绘）。
 *
 * 与原来的「胶囊行」（listShared/ListCategoryChips）相比，这里换成了左侧栏布局：
 * 需求要「左侧收藏夹列表 + 右侧内容网格」，胶囊行在宽屏下会浪费一行高度。
 *
 * 行为：
 * - 点击切换收藏夹（当前项高亮 + aria-current）；
 * - 每个收藏夹右侧「更多」菜单：重命名 / 删除（删除有二次确认，文案说明视频不会被删除）；
 * - 底部「+ 新建收藏夹」行内输入：Enter 提交 / Esc 取消 / 空标题禁用；
 * - 所有写操作由父级（FavoritesPage）执行，本组件只发事件；
 *   失败时父级 toast 报错、不改数据，输入内容自然保留。
 * - 焦点管理：重命名 / 新建输入打开时把焦点移进去，Esc 取消。
 */
import { nextTick } from 'vue'

interface FolderEntry { id: number, title: string, count: number }

const props = withDefaults(defineProps<{
  folders: FolderEntry[]
  selectedId?: number
  pending?: boolean
  createPending?: boolean
  creating?: boolean
  createDraft?: string
  /** 文案（父级统一从 ListsDrawn/i18n 取，避免每个组件各建一份词典） */
  labels: {
    title: string
    create: string
    placeholder: string
    rename: string
    remove: string
    removeTitle: string
    removeDesc: string
    cancel: string
    working: string
  }
}>(), {
  selectedId: undefined,
  pending: false,
  createPending: false,
  creating: false,
  createDraft: '',
})

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'rename', id: number, title: string): void
  (e: 'remove', id: number): void
  (e: 'openCreate'): void
  (e: 'cancelCreate'): void
  (e: 'create', title: string): void
}>()

/** 当前展开菜单的收藏夹 id */
const menuId = ref<number | null>(null)
/** 当前展开确认框的收藏夹 id */
const confirmId = ref<number | null>(null)
/** 当前重命名的收藏夹 id 与草稿 */
const renameId = ref<number | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const createInputRef = ref<HTMLInputElement | null>(null)
/** 新建收藏夹的本地草稿：父级只关心最终提交的标题 */
const draft = ref('')

function toggleMenu(id: number) {
  confirmId.value = null
  menuId.value = menuId.value === id
    ? null
    : id
}

function startRename(folder: FolderEntry) {
  menuId.value = null
  confirmId.value = null
  renameId.value = folder.id
  renameDraft.value = folder.title
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function submitRename() {
  if (renameId.value === null)
    return
  const value = renameDraft.value.trim()
  if (!value) {
    cancelRename()
    return
  }
  emit('rename', renameId.value, value)
  renameId.value = null
}

function cancelRename() {
  renameId.value = null
  renameDraft.value = ''
}

function askRemove(id: number) {
  menuId.value = null
  confirmId.value = id
}

function confirmRemove() {
  if (confirmId.value === null)
    return
  emit('remove', confirmId.value)
  confirmId.value = null
}

function cancelRemove() {
  confirmId.value = null
}

watch(() => props.creating, async (value) => {
  if (!value) {
    draft.value = ''
    return
  }
  // 展开时用父级给的值作为初始草稿（父级可能预先填了内容）
  draft.value = props.createDraft
  await nextTick()
  createInputRef.value?.focus()
})

function submitCreate() {
  const value = draft.value.trim()
  if (!value)
    return
  emit('create', value)
}
</script>

<template>
  <aside class="lists-fav-side" :aria-label="labels.title">
    <h2 class="lists-fav-side__title">
      {{ labels.title }}
    </h2>

    <ul class="lists-fav-side__list">
      <li v-for="folder in folders" :key="folder.id" class="lists-fav-side__item">
        <div v-if="renameId === folder.id" class="lists-fav-side__rename">
          <input
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            :placeholder="labels.placeholder"
            :aria-label="labels.rename"
            @keydown.enter.prevent="submitRename"
            @keydown.esc.prevent="cancelRename"
          >
          <button type="button" class="lists-fav-side__mini" :title="labels.cancel" @click="cancelRename">
            <span class="i-mingcute:close-line" aria-hidden="true" />
          </button>
        </div>

        <template v-else>
          <button
            type="button"
            class="lists-fav-side__link"
            :class="{ 'is-active': folder.id === selectedId }"
            :aria-current="folder.id === selectedId ? 'true' : undefined"
            :disabled="pending"
            @click="emit('select', folder.id)"
          >
            <span class="lists-fav-side__name" :title="folder.title">{{ folder.title }}</span>
            <span class="lists-fav-side__count">{{ folder.count }}</span>
          </button>

          <button
            type="button"
            class="lists-fav-side__more"
            :aria-expanded="menuId === folder.id"
            :title="labels.rename"
            :disabled="pending"
            @click.stop="toggleMenu(folder.id)"
          >
            <span class="i-mingcute:more-2-line" aria-hidden="true" />
          </button>

          <div v-if="menuId === folder.id" class="lists-fav-side__menu" role="menu">
            <button type="button" role="menuitem" @click="startRename(folder)">
              {{ labels.rename }}
            </button>
            <button type="button" role="menuitem" class="is-danger" :disabled="pending" @click="askRemove(folder.id)">
              {{ labels.remove }}
            </button>
          </div>

          <div v-if="confirmId === folder.id" class="lists-fav-side__confirm" role="alertdialog">
            <p class="lists-fav-side__confirm-title">
              {{ labels.removeTitle.replace("{name}", folder.title) }}
            </p>
            <p class="lists-fav-side__confirm-desc">
              {{ labels.removeDesc }}
            </p>
            <div class="lists-fav-side__confirm-actions">
              <button type="button" class="lists-fav-side__mini" @click="cancelRemove">
                {{ labels.cancel }}
              </button>
              <button type="button" class="lists-fav-side__mini is-danger" :disabled="pending" @click="confirmRemove">
                {{ pending ? labels.working : labels.remove }}
              </button>
            </div>
          </div>
        </template>
      </li>
    </ul>

    <div v-if="creating" class="lists-fav-side__create">
      <input
        ref="createInputRef"
        v-model="draft"
        type="text"
        :placeholder="labels.placeholder"
        :aria-label="labels.create"
        @keydown.enter.prevent="submitCreate"
        @keydown.esc.prevent="emit('cancelCreate')"
      >
      <button
        type="button"
        class="lists-fav-side__mini is-primary"
        :disabled="createPending || !draft.trim()"
        @click="submitCreate"
      >
        <span class="i-tabler:check" aria-hidden="true" />
      </button>
      <button type="button" class="lists-fav-side__mini" @click="emit('cancelCreate')">
        <span class="i-mingcute:close-line" aria-hidden="true" />
      </button>
    </div>

    <button
      v-else
      type="button"
      class="lists-fav-side__add"
      :disabled="createPending"
      @click="emit('openCreate')"
    >
      <span class="i-tabler:plus" aria-hidden="true" />
      <span>{{ labels.create }}</span>
    </button>
  </aside>
</template>
