<script setup lang="ts">
/**
 * 自绘评论输入框（第 110 轮）。
 *
 * # 为什么必须自绘（真机实测，2026-11-19）
 *
 * 本轮原始设计是「隐藏原生列表、保留原生输入框」。但真机验证（探针 out-12 / out-13）表明：
 * 扩展接管后 **原生 \`bili-comments\` 从未挂载** —— \`#commentapp\` 里始终是空的
 * （等 30s + 滚动到底 + 手动 \`createElement('bili-comments')\` 都无法让自定义元素升级，
 * \`customElements.get('bili-comments')\` 为 undefined，说明 B 站的评论组件脚本根本没加载到这一步）。
 * 上一版 \`commentList.ts\` 又给 \`#commentapp\` 写了 \`display:none\`，
 * 结果就是**页面上没有任何发评论入口**。
 *
 * 所以自绘层提供自己的输入框：已登录 → textarea + 字数计数 + 发布（Ctrl/⌘+Enter）；
 * 未登录 / 读不到 csrf → 「登录后可以发评论」+ 去登录。
 *
 * 数据走 \`/x/v2/reply/add\`（需要 cookie 里的 \`bili_jct\`）。
 */
import { computed, onMounted, ref } from 'vue'
import { addComment, fetchSelfProfile, MAX_COMMENT_LENGTH } from './fetcher'
import { useCommentDrawnI18n } from './i18n'

const props = defineProps<{
  aid: number
}>()

const emit = defineEmits<{
  /** 发表成功：把新评论交给列表本地插入（不等下一次刷新） */
  (e: 'posted', payload: { rpid: string }): void
}>()

const { t } = useCommentDrawnI18n()

const value = ref('')
const submitting = ref(false)
const errorText = ref('')
const loggedIn = ref(false)
const ready = ref(false)

const countText = computed(() => `${value.value.length}/${MAX_COMMENT_LENGTH}`)
const canSubmit = computed(() => Boolean(value.value.trim()) && !submitting.value)

onMounted(async () => {
  const self = await fetchSelfProfile()
  loggedIn.value = Boolean(self)
  ready.value = true
})

async function submit(): Promise<void> {
  if (!canSubmit.value)
    return
  submitting.value = true
  errorText.value = ''
  const result = await addComment(props.aid, value.value)
  submitting.value = false
  if (!result.ok) {
    errorText.value = result.message || t.value.errorTitle
    return
  }
  value.value = ''
  emit('posted', { rpid: result.rpid })
}

/** Ctrl / ⌘ + Enter 快捷发布 */
function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void submit()
  }
}
</script>

<template>
  <form class="bcd-compose" @submit.prevent="submit">
    <template v-if="!ready">
      <span class="bcd-compose__hint">{{ t.loadingMore }}</span>
    </template>
    <template v-else-if="loggedIn">
      <textarea
        v-model="value"
        class="bcd-compose__input"
        rows="2"
        :maxlength="MAX_COMMENT_LENGTH"
        :placeholder="t.composerPlaceholder"
        @keydown="onKeydown"
      />
      <div class="bcd-compose__row">
        <span class="bcd-compose__count">{{ countText }}</span>
        <span v-if="errorText" class="bcd-compose__error" role="alert">{{ errorText }}</span>
        <button type="submit" class="bcd-compose__submit" :disabled="!canSubmit">
          {{ submitting ? t.composerSubmitting : t.composerSubmit }}
        </button>
      </div>
    </template>
    <template v-else>
      <span class="bcd-compose__hint">
        {{ t.composerLoginHint }}
        <a class="bcd-compose__link" href="https://passport.bilibili.com/login" target="_blank" rel="noreferrer noopener">
          {{ t.composerLogin }}
        </a>
      </span>
    </template>
  </form>
</template>

<style scoped>
/**
 * 底部发送区（第 112 轮修）。
 *
 * 原来只有 `flex: 0 0 auto` —— 在 `#bewly-comment-drawn` 拿到确定高度、列表内部滚动时
 * 它确实在底部；但一旦外层高度不确定（评论列被原生布局收缩/hover 展开），
 * 整个自绘块会跟着页面滚走，用户就看不到发送框了。
 * 加 `position: sticky; bottom: 0` 做双保险：外层是滚动容器时贴底，
 * 外层不是时退化成普通流式块，不会破坏布局。
 */
/*
 * 第 129 轮：与评论区四周对齐。
 *
 * 原来发送区**左右撑满** `#bewly-comment-drawn`，而评论列表有 `padding: 0 12px`，
 * 于是发送框比评论宽出 14px（用户反馈「评论编辑区域与评论区四周贴合有问题」）。
 * 这里补 `margin-inline`，让输入框的左右边缘与评论正文对齐；
 * 背景同时换成**不透明**的 `--bew-bg`（深色下 `--bew-elevated` 可能带透明度，
 * 会让下面滚过去的评论透出来）。
 */
.bcd-compose {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 6px;
  margin: 0 12px;
  padding: 8px 0 10px;
  background: var(--bew-bg, #fff);
  border-top: 1px solid var(--bew-fill-1);
  backdrop-filter: var(--bew-filter-force-dark, none);
}

.bcd-compose__input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bew-text-1);
  resize: vertical;
  background: var(--bew-fill-1);
  border: 0;
  border-radius: 8px;
  outline: none;
}

.bcd-compose__input::placeholder {
  color: var(--bew-text-3);
}

.bcd-compose__row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bcd-compose__count {
  font-size: 12px;
  color: var(--bew-text-3);
}

.bcd-compose__error {
  flex: 1 1 auto;
  font-size: 12px;
  color: var(--bew-theme-color, hsl(0 70% 60%));
}

.bcd-compose__submit {
  height: 28px;
  padding: 0 16px;
  margin-left: auto;
  font-size: 12.5px;
  color: #fff;
  cursor: pointer;
  background: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
  border: 0;
  border-radius: 14px;
}

.bcd-compose__submit:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.bcd-compose__hint {
  font-size: 12.5px;
  color: var(--bew-text-3);
}

.bcd-compose__link {
  color: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
}
</style>
