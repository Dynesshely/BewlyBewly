/**
 * 把原生「弹幕列表」搬进评论区的「弹幕」标签页（第 128 轮）。
 *
 * # 真机结构（2026-11-20 实测，BV1Nisz6EEuH）
 *
 *   .video-pod-above-modules > .video-pod-above-modules__inner
 *     > #danmukuBox.danmaku-box > .danmaku-wrap > .bpx-docker...
 *       > .bpx-player-collapse.bui-collapse > .bui-collapse-wrap
 *           .bui-collapse-header      ← 折叠条「弹幕列表 ▾」
 *           .bui-collapse-body > .bpx-player-wraplist > ... > .bpx-player-dm-container
 *
 * # 两个坑
 *
 * 1. **默认是折叠的**：`.bui-collapse-wrap` 带 `bui-collapse-wrap-folded`，
 *    `.bui-collapse-body` 高度为 0、`.bpx-player-dm-wrap` 是 `display:none`；
 * 2. **列表懒加载**：不展开的话文案停在「弹幕列表填充中...」，永远没有数据。
 *
 * 所以搬之前必须先**触发展开**（点 header）并移除 folded 类，等一拍再测量。
 */

/** 候选选择器（B 站改版时按顺序退让） */
const DANMAKU_WRAP_SELECTORS = [
  // 真机实测（2026-11-20）：新版结构里 wrap 的父级是 `.bui-area`，
  // 不再是 `.bpx-player-collapse` —— 所以这里**不能写死中间层**，
  // 用「祖先链里出现 danmukuBox / video-pod-above-modules」来判定。
  '.video-pod-above-modules .bui-collapse-wrap',
  '#danmukuBox .bui-collapse-wrap',
  '.danmaku-box .bui-collapse-wrap',
  '.danmaku-wrap .bui-collapse-wrap',
] as const

const FOLDED_CLASS = 'bui-collapse-wrap-folded'

export interface MovedDanmaku {
  /** 把节点放回原位（幂等） */
  restore: () => void
}

/** 找到原生弹幕列表的折叠容器 */
export function findDanmakuWrap(): HTMLElement | null {
  for (const selector of DANMAKU_WRAP_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el)
      return el
  }
  // 兜底：按「折叠条文案包含弹幕」找 —— B 站改版时这条通常还能命中
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.bui-collapse-wrap'))) {
    const header = el.querySelector<HTMLElement>('.bui-collapse-header')
    const text = (header?.textContent ?? '').replace(/\s+/g, '')
    if (text.includes('弹幕'))
      return el
  }
  return null
}

/**
 * 展开折叠容器，触发懒加载。
 *
 * ⚠️ 第 130 轮：**不能只在 `folded` 时展开**。
 * 真机踩到的顺序是：B 站先把 wrap 渲染成「已展开但 body 还没填充」的中间态，
 * 我们搬走时 `folded` 类已经不在 → 跳过展开 → body 高度 0 → 懒加载永不触发，
 * 搬到 tab 里只有几百字符的「弹幕列表 / 屏蔽设定」骨架文案。
 * 所以这里**无条件**点一次 header（点开→点回，净效果是展开并触发加载），
 * 再清掉 body 上可能存在的内联尺寸限制。
 */
export function expandDanmaku(wrap: HTMLElement): void {
  const header = wrap.querySelector<HTMLElement>('.bui-collapse-header')
  const body = wrap.querySelector<HTMLElement>('.bui-collapse-body')

  /**
   * ⚠️ 第 130 轮：header.click() 是 **toggle**，多次调用会互相抵消。
   * 真机踩过：延迟补点 3 次（1s/2s/4s）→ body 高度最后变成 **0**（被点回折叠态）。
   * 所以这里改成**幂等**：只在「当前是折叠态」时点一次，点完再检查 body，
   * 高度还是 0 就再点一次；绝不无条件连点。
   */
  // ⚠️ 判定**只认 folded 类**，不能用「body 高度 < 8」——
  // 弹幕列表展开后如果数据没填充（B 站加载器在节点被搬走后不工作），body 高度本来就是 0，
  // 用高度判折叠会导致每次重试都点一下、反复 toggle，最终停在折叠态（真机验证过）。
  if (header && wrap.classList.contains(FOLDED_CLASS)) {
    try {
      header.click()
    }
    catch {
      // header 绑的是自定义事件时 click 可能抛错，退回去掉类
    }
  }
  wrap.classList.remove(FOLDED_CLASS)

  // 清掉 body 上可能存在的内联尺寸限制
  if (body) {
    body.style.removeProperty('height')
    body.style.removeProperty('display')
  }
  const dmWrap = wrap.querySelector<HTMLElement>('.bpx-player-dm-wrap')
  if (dmWrap) {
    dmWrap.style.removeProperty('display')
    dmWrap.style.removeProperty('height')
  }
}

/**
 * 把弹幕列表搬进 `container`，返回 restore。
 *
 * 找不到节点时返回 null（调用方据此显示「该视频没有弹幕列表」）。
 */
export function moveDanmakuInto(container: HTMLElement): MovedDanmaku | null {
  const wrap = findDanmakuWrap()
  if (!wrap)
    return null
  if (wrap.parentElement === container) {
    return {
      restore: () => {},
    }
  }

  const originalParent = wrap.parentElement
  const originalNext = wrap.nextSibling

  // 记录原位置后先展开（顺序很重要：展开会改内部结构，但不会换父级）
  expandDanmaku(wrap)

  // 搬进来时去掉原生的定位 / 尺寸约束，让它填满我们的面板
  wrap.dataset.bewlyDanmakuMoved = ''
  wrap.style.setProperty('position', 'static', 'important')
  wrap.style.setProperty('width', '100%', 'important')
  wrap.style.setProperty('height', '100%', 'important')
  wrap.style.setProperty('margin', '0', 'important')
  wrap.style.setProperty('border-radius', '0', 'important')
  wrap.style.setProperty('box-shadow', 'none', 'important')

  // 折叠条钉成 40px 单行、箭头 16px。
  // B 站原样式在容器被拉到 height:100% 之后，header 是 display:block 且 SVG 无尺寸约束
  // → 箭头被拉伸成 790×790、header 撑到 814px、列表体被挤出视口（用户只看到一个巨大的「>」）。
  // 这里用**内联 !important**：CSS 选择器再提特异性也压不过 B 站自己的 !important 规则。
  const header = wrap.querySelector<HTMLElement>('.bui-collapse-header')
  if (header) {
    header.style.setProperty('display', 'flex', 'important')
    header.style.setProperty('align-items', 'center', 'important')
    header.style.setProperty('box-sizing', 'border-box', 'important')
    header.style.setProperty('height', '40px', 'important')
    header.style.setProperty('min-height', '40px', 'important')
    header.style.setProperty('max-height', '40px', 'important')
    header.style.setProperty('padding', '0 12px', 'important')
    header.style.setProperty('overflow', 'hidden', 'important')
    for (const svg of Array.from(header.querySelectorAll<SVGElement>('svg'))) {
      svg.style.setProperty('width', '16px', 'important')
      svg.style.setProperty('height', '16px', 'important')
      svg.style.setProperty('min-width', '16px', 'important')
      svg.style.setProperty('min-height', '16px', 'important')
      svg.style.setProperty('max-width', '16px', 'important')
      svg.style.setProperty('max-height', '16px', 'important')
    }
  }

  container.appendChild(wrap)

  // 折叠条的文案改成「弹幕列表」并保留可点击（用户仍能收起来）
  return {
    restore: () => {
      wrap.removeAttribute('data-bewly-danmaku-moved')
      wrap.style.removeProperty('position')
      wrap.style.removeProperty('width')
      wrap.style.removeProperty('height')
      wrap.style.removeProperty('margin')
      wrap.style.removeProperty('border-radius')
      wrap.style.removeProperty('box-shadow')
      if (originalParent && wrap.parentElement !== originalParent)
        originalParent.insertBefore(wrap, originalNext)
    },
  }
}
