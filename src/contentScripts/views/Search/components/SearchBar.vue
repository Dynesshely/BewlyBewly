<script setup lang="ts">
/**
 * 自绘搜索页的搜索框。
 *
 * 只做一件事：输入 + 回车（或点「搜索」）把关键词交给父组件。
 * 父组件负责写地址栏并重拉数据 —— 这里**不做**跳转 / 新标签页打开，
 * 因为整页已经由自绘层接管，跳页会丢掉覆盖层。
 *
 * 不用 \`components/SearchBar\`（首页那个）：它带热搜 / 历史 / 联想面板，
 * 而且命中后是 window.open 去原生搜索页，语义与这里相反。
 */
import { useSearchDrawnI18n } from '../searchDrawnI18n'

const props = defineProps<{
  /** 当前生效的关键词（由父组件持有） */
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'submit', keyword: string): void
}>()

const { t } = useSearchDrawnI18n()

/** 输入草稿：只有提交时才交给父组件，输入过程中不改任何状态 */
const draft = ref<string>(props.modelValue)
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, (value) => {
  draft.value = value
})

function submit() {
  const keyword = draft.value.trim()
  // 空关键词会让接口返回 -400，也不该把页面变成「空搜索」
  if (!keyword) {
    inputRef.value?.focus()
    return
  }
  emit('submit', keyword)
}
</script>

<template>
  <form class="search-bar" role="search" @submit.prevent="submit">
    <span class="search-bar__icon i-mingcute:search-line" aria-hidden="true" />
    <input
      ref="inputRef"
      v-model="draft"
      class="search-bar__input"
      type="search"
      name="keyword"
      autocomplete="off"
      spellcheck="false"
      :aria-label="t.searchAria"
      :placeholder="t.searchPlaceholder"
    >
    <button class="search-bar__submit" type="submit">
      {{ t.searchSubmit }}
    </button>
  </form>
</template>
