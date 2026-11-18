<script setup lang="ts">
/**
 * UP 信息卡（自绘）。
 *
 * 数据全部来自 /x/space/wbi/acc/info + /x/relation/stat（mount.ts 已在接管前预取），
 * 不再读原生 DOM —— 接管成功后原生头部已被隐藏。
 *
 * 关注按钮走 /x/relation/modify（未登录时先检查 csrf，不发请求只提示），
 * 成功后把关注状态同步回本组件；失败保留原状态并提示。
 */
import type { SpaceRelationStatResult, SpaceUpInfo } from '../types'
import { useToast } from 'vue-toastification'
import { numFormatter } from '~/utils/dataFormatter'
import { modifySpaceRelation } from '../fetcher'
import { useSpaceI18n } from '../i18n'
import { bannerUrl, faceWithSize, officialText } from '../utils'

const props = defineProps<{
  upInfo: SpaceUpInfo
  relationStat: SpaceRelationStatResult
}>()

const toast = useToast()
const { t, levelText } = useSpaceI18n()

/** 关注状态：接口给的是「当前登录用户是否已关注」 */
const followed = ref<boolean>(Boolean(props.upInfo.is_followed))
const pending = ref<boolean>(false)
/** 头像加载失败时用昵称首字兜底 */
const avatarFailed = ref<boolean>(false)

// 切换 UP（SPA 内进入另一个人的主页）时同步关注态
watch(() => props.upInfo, (info) => {
  followed.value = Boolean(info.is_followed)
}, { deep: false })

const banner = computed(() => bannerUrl(props.upInfo))
/** 头图加载失败（或接口没给）时整条不渲染，退回页面底色 */
const bannerFailed = ref<boolean>(false)
watch(() => props.upInfo.mid, () => {
  bannerFailed.value = false
})

const avatarUrl = computed(() => faceWithSize(props.upInfo.face))
const avatarInitial = computed(() => (props.upInfo.name || '?').slice(0, 1))
const official = computed(() => officialText(props.upInfo))
/** 大会员（vip.type 1/2 且 status 1）—— 与原生一致只在有效期内显示 */
const isVip = computed(() => {
  const vip = props.upInfo.vip
  return Boolean(vip && vip.status === 1 && (vip.type ?? 0) > 0)
})
/** 粉丝 / 关注数：接口失败时整项不渲染，而不是显示 0 */
const followerText = computed(() => props.relationStat
  ? numFormatter(props.relationStat.follower)
  : '')
const followingText = computed(() => props.relationStat
  ? numFormatter(props.relationStat.following)
  : '')

const followLabel = computed(() => followed.value ? t.value.followed : t.value.follow)

async function toggleFollow() {
  if (pending.value)
    return
  pending.value = true
  const result = await modifySpaceRelation(props.upInfo.mid, followed.value)
  pending.value = false
  if (result.ok) {
    followed.value = result.followed
    return
  }
  toast.error(result.reason === 'login'
    ? t.value.followLogin
    : t.value.followFailed)
}

/** 头像：优先用 img，失败退回首字 */
function handleAvatarError() {
  avatarFailed.value = true
}
</script>

<template>
  <section class="space-profile" :data-bewly-space-profile="upInfo.mid">
    <!-- 头图：接口 top_photo_v2.l_200h_img（原生同一张）；没有 / 失败就整条不渲染 -->
    <div v-if="banner && !bannerFailed" class="space-profile__banner" aria-hidden="true">
      <img
        :src="banner"
        alt=""
        loading="eager"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="bannerFailed = true"
      >
    </div>

    <div class="space-profile__main">
      <div class="space-profile__avatar">
        <img
          v-if="avatarUrl && !avatarFailed"
          :src="avatarUrl"
          alt=""
          loading="eager"
          decoding="async"
          referrerpolicy="no-referrer"
          @error="handleAvatarError"
        >
        <span v-else class="space-profile__avatar-fallback">
          {{ avatarInitial }}
        </span>
      </div>

      <div class="space-profile__info">
        <div class="space-profile__name-row">
          <h1 class="space-profile__name" :title="upInfo.name">
            {{ upInfo.name }}
          </h1>
          <span
            v-if="levelText(upInfo.level)"
            class="space-profile__badge space-profile__badge--level"
          >
            {{ levelText(upInfo.level) }}
          </span>
          <span v-if="isVip" class="space-profile__badge space-profile__badge--vip">
            {{ t.vip }}
          </span>
          <span v-if="official" class="space-profile__badge" :title="official">
            {{ official }}
          </span>
        </div>

        <p v-if="upInfo.sign" class="space-profile__signature" :title="upInfo.sign">
          {{ upInfo.sign }}
        </p>

        <div v-if="followerText || followingText" class="space-profile__stats">
          <span v-if="followerText" class="space-profile__stat">
            <strong class="space-profile__stat-value">{{ followerText }}</strong>
            <span>{{ t.fans }}</span>
          </span>
          <span v-if="followingText" class="space-profile__stat">
            <strong class="space-profile__stat-value">{{ followingText }}</strong>
            <span>{{ t.following }}</span>
          </span>
        </div>
      </div>

      <div class="space-profile__actions">
        <button
          class="space-profile__follow"
          :class="{ 'space-profile__follow--following': followed }"
          type="button"
          :disabled="pending"
          :aria-pressed="followed"
          @click="toggleFollow"
        >
          {{ followLabel }}
        </button>
      </div>
    </div>
  </section>
</template>
