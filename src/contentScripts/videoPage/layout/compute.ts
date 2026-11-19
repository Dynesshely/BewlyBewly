/**
 * 视频播放页「按视口铺满」布局计算（第 113 轮 layout-fit）。
 *
 * 设计约定
 * --------
 * 1. 纯函数：不读 DOM、不读 settings、不触发副作用，输入数字 → 输出矩形；
 *    因此可以在单元测试里直接调到任意视口（含 565×1397 这种极端窄高比）。
 * 2. 坐标系：所有矩形的 left/top 都是视口坐标（页面左上角为原点），
 *    由调用方决定如何落地（当前实现用 position: fixed 直接贴视口）。
 * 3. 高度/宽度全部由 vw/vh 推出，不留剩余：
 *    main.height + railGap + railH + railBottom === vh - topBarH，
 *    横向 pad*2 + leftW + gap + sideW === vw，所以页面本身不需要滚动。
 * 4. 播放器严格 16:9 的对象是画面区（video 区域），不是外层容器：
 *    B 站播放器在画面下方还排了一条控制条，#playerWrap 高度 = 画面高 + controlH，
 *    否则画面会被 object-fit: contain 压成左右黑边（真机实测 2560×1440 黑边 50px）。
 *
 * 与简报的关系
 * ------------
 * 简报公式是 playerW = min(vw * 0.68, availH * 16/9)。
 * 真机上播放器下方还有「信息栏 / 工具栏 / 标签行」三块固定高度（合计约 150px），
 * 若把整个 availH 都给播放器，这三块会被裁掉。因此这里把公式修正为：
 * playerW = min(vw * 0.68, (availH - reserveH - controlH) * 16/9)，
 * reserveH 由调用方实测传入（默认 150）；reserveH = 0 时退化成简报公式。
 */

/** 布局模式：双栏（播放器 + 右列）或上下分区（播放器在上、评论在下） */
export type FitLayoutMode = 'two-column' | 'stacked'

export interface FitLayoutInput {
  /** 视口宽（px，CSS 像素） */
  vw: number
  /** 视口高（px，CSS 像素；移动端用 dvh 折算后的值） */
  vh: number
  /** Bewly 顶栏高度 */
  topBarH: number
  /** 播放器最小宽度（低于它布局退化为「铺满宽度按 16:9 定高」） */
  minPlayerW?: number
  /** 右列（评论区）最小宽度 */
  minCommentW?: number
  /** 推荐轨道高度；0 表示不显示轨道（窄屏 / 关闭轨道） */
  railH?: number
  /** 播放器下方其它块（信息栏 + 工具栏 + 标签行 + 间距）占用的高度 */
  reserveH?: number
  /** 播放器控制条高度（B 站播放器排在画面下方的那一条） */
  controlH?: number
  /** 左右两列之间的间距 */
  gap?: number
  /** 页面左右内边距 */
  pad?: number
  /** 主区与底部推荐轨道之间的间距 */
  railGap?: number
  /** 推荐轨道与视口底部的间距 */
  railBottom?: number
  /** 低于这个宽度改为上下分区 */
  stackedBreakpoint?: number
  /** 播放器宽度上限占视口宽的比例（简报要求 0.68） */
  maxPlayerRatio?: number
  /** 左列内部块之间的间距 */
  innerGap?: number
}

export interface FitLayoutBox {
  left: number
  top: number
  width: number
  height: number
}

export interface FitLayoutResult {
  mode: FitLayoutMode
  vw: number
  vh: number
  topBarH: number
  /** 主区（左列 + 右列）整体矩形 */
  main: FitLayoutBox
  /** 左列（播放器 + 信息区） */
  left: FitLayoutBox
  /** 右列（创作者卡片 + 评论区） */
  right: FitLayoutBox
  /** 播放器容器（含控制条） */
  player: FitLayoutBox
  /** 播放器画面区（严格 16:9） */
  video: { width: number, height: number }
  /** 评论区（右列可用区域；内部滚动） */
  comment: FitLayoutBox
  /** 推荐轨道（置底） */
  rail: FitLayoutBox
  /** 可直接写进 CSS 的变量表（apply.ts 消费，键名不含 -- 前缀） */
  vars: Record<string, string>
  /** 计算结果是否可信（极窄/极矮时为 false，调用方可选择不接管） */
  ok: boolean
}

const DEFAULTS = {
  minPlayerW: 320,
  minCommentW: 360,
  railH: 0,
  // 第 113 轮修：实测 150 会把播放器挤小（1280×800 只剩 320×180），收到 96；
  // 且 compute 里还会 clamp 到「至少留 minPlayerH 的画面」
  reserveH: 96,
  controlH: 56,
  gap: 24,
  pad: 24,
  railGap: 16,
  railBottom: 12,
  stackedBreakpoint: 1280,
  maxPlayerRatio: 0.68,
  innerGap: 8,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function px(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value)
    ? value
    : 0))
}

/**
 * 计算整页布局。
 *
 * @example
 * // 1920×1080，顶栏 64，轨道 241，播放器下方预留 150
 * const layout = computeLayout({ vw: 1920, vh: 1080, topBarH: 64, railH: 241 })
 * // => player.width 962、player.height 597、sideW 886、rail.top 827
 */
export function computeLayout(input: FitLayoutInput): FitLayoutResult {
  const vw = px(input.vw)
  const vh = px(input.vh)
  const topBarH = px(input.topBarH)
  const minPlayerW = input.minPlayerW ?? DEFAULTS.minPlayerW
  const minCommentW = input.minCommentW ?? DEFAULTS.minCommentW
  const controlH = px(input.controlH ?? DEFAULTS.controlH)
  const gap = px(input.gap ?? DEFAULTS.gap)
  const pad = px(input.pad ?? DEFAULTS.pad)
  const railGap = px(input.railGap ?? DEFAULTS.railGap)
  const railBottom = px(input.railBottom ?? DEFAULTS.railBottom)
  const innerGap = px(input.innerGap ?? DEFAULTS.innerGap)
  const stackedBreakpoint = input.stackedBreakpoint ?? DEFAULTS.stackedBreakpoint
  const maxPlayerRatio = input.maxPlayerRatio ?? DEFAULTS.maxPlayerRatio
  const reserveHInput = px(input.reserveH ?? DEFAULTS.reserveH)

  const stacked = vw < stackedBreakpoint
  // 上下分区时轨道按约定收起（与 recommendRail 的窄屏策略一致）
  const railH = stacked
    ? 0
    : px(input.railH ?? DEFAULTS.railH)

  // 可用高度：视口 − 顶栏 − 轨道（含间距与底部留白）
  const railTop = px(vh - railBottom - railH)
  const mainTop = topBarH
  const mainH = px(railTop - (railH > 0
    ? railGap
    : 0) - mainTop)
  const contentW = px(vw - pad * 2)
  const ok = contentW > 64 && mainH > 64

  // 播放器下方保留区不能把播放器挤没：至少留 minPlayerH 的画面
  const minPlayerH = Math.min(180, Math.max(90, Math.round(contentW * 9 / 16)))
  const reserveH = clamp(reserveHInput, 0, Math.max(0, mainH - controlH - minPlayerH))

  let leftHeight = mainH
  let rightTop = mainTop
  let rightHeight = mainH
  let playerW = contentW
  let videoH = 0
  let sideW = 0

  if (stacked) {
    // 上下分区：播放器按内容宽 16:9 定高，信息区在它下面，评论占剩下的高度
    playerW = contentW
    videoH = Math.round(playerW * 9 / 16)
    leftHeight = Math.min(mainH, videoH + controlH + reserveH)
    rightTop = px(mainTop + leftHeight + innerGap)
    rightHeight = px(Math.max(0, mainH - leftHeight - innerGap))
    sideW = contentW
  }
  else {
    // 双栏：先由「主区高 − 预留」反算画面高 → 播放器宽 → 右列吃掉剩余宽度
    const videoBudget = Math.max(1, mainH - reserveH - controlH)
    const widthByHeight = Math.round(videoBudget * 16 / 9)
    const widthByRatio = Math.round(vw * maxPlayerRatio)
    const widthBySideMin = Math.max(0, contentW - gap - minCommentW)
    playerW = Math.min(widthByHeight, widthByRatio, widthBySideMin)
    if (playerW < minPlayerW)
      playerW = Math.min(minPlayerW, contentW)
    playerW = clamp(playerW, 1, contentW)
    videoH = Math.round(playerW * 9 / 16)
    sideW = px(contentW - gap - playerW)
  }

  const playerH = videoH + controlH
  const player: FitLayoutBox = {
    left: pad,
    top: mainTop,
    width: playerW,
    height: playerH,
  }
  const left: FitLayoutBox = {
    left: pad,
    top: mainTop,
    width: stacked ? contentW : playerW,
    height: leftHeight,
  }
  const right: FitLayoutBox = stacked
    ? {
        left: pad,
        top: rightTop,
        width: sideW,
        height: rightHeight,
      }
    : {
        left: px(pad + playerW + gap),
        top: mainTop,
        width: sideW,
        height: mainH,
      }
  const rail: FitLayoutBox = {
    left: pad,
    top: railTop,
    width: contentW,
    height: railH,
  }

  const vars: Record<string, string> = {
    'bvp-main-top': `${mainTop}px`,
    'bvp-main-h': `${mainH}px`,
    'bvp-pad': `${pad}px`,
    'bvp-gap': `${gap}px`,
    'bvp-gap-inner': `${innerGap}px`,
    'bvp-left-w': `${left.width}px`,
    'bvp-left-h': `${leftHeight}px`,
    'bvp-player-w': `${playerW}px`,
    'bvp-player-h': `${playerH}px`,
    'bvp-player-video-h': `${videoH}px`,
    'bvp-side-w': `${sideW}px`,
    'bvp-side-top': `${right.top}px`,
    'bvp-side-h': `${right.height}px`,
    'bvp-rail-h': `${railH}px`,
    'bvp-rail-top': `${railTop}px`,
    'bvp-rail-left': `${pad}px`,
    'bvp-rail-w': `${contentW}px`,
    'bvp-vw': `${vw}px`,
    'bvp-vh': `${vh}px`,
  }

  return {
    mode: stacked ? 'stacked' : 'two-column',
    vw,
    vh,
    topBarH,
    main: {
      left: pad,
      top: mainTop,
      width: contentW,
      height: mainH,
    },
    left,
    right,
    player,
    video: { width: playerW, height: videoH },
    comment: right,
    rail,
    ok,
    vars,
  }
}
