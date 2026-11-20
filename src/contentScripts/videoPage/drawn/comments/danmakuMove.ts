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
  '.video-pod-above-modules .bpx-player-collapse .bui-collapse-wrap',
  '#danmukuBox .bpx-player-collapse .bui-collapse-wrap',
  '#danmukuBox .bui-collapse-wrap',
  '.danmaku-box .bui-collapse-wrap',
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
  return null
}

/** 展开折叠容器，触发懒加载 */
export function expandDanmaku(wrap: HTMLElement): void {
  if (wrap.classList.contains(FOLDED_CLASS)) {
    const header = wrap.querySelector<HTMLElement>('.bui-collapse-header')
    if (header) {
      try {
        header.click()
      }
      catch {
        // 某些版本 header 是 div 但绑了自定义事件，click 失败就退回去掉类
      }
    }
    wrap.classList.remove(FOLDED_CLASS)
  }
  // 有的版本用一个 inline height:0 / display:none 控制 body
  const body = wrap.querySelector<HTMLElement>('.bui-collapse-body')
  if (body) {
    body.style.removeProperty('height')
    body.style.removeProperty('display')
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
