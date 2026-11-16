/**
 * 评论图片预览层（第 82 轮）。
 *
 * 纯前端实现：全屏遮罩 + 居中图片，支持 Esc / 点击空白关闭、多图左右切换、滚轮缩放。
 * 不引新依赖；挂到 document.body（z-index 高于视频页宿主）。
 */
const VIEWER_ID = 'bewly-image-viewer'

interface ViewerState {
  urls: string[]
  index: number
  scale: number
}

let state: ViewerState | null = null
let root: HTMLElement | null = null

function render(): void {
  if (!root || !state)
    return
  const url = state.urls[state.index]
  const img = root.querySelector<HTMLImageElement>('.bvp-viewer__img')
  if (img) {
    img.src = url
    img.style.transform = `scale(${state.scale})`
  }
  const counter = root.querySelector<HTMLElement>('.bvp-viewer__counter')
  if (counter) {
    counter.textContent = state.urls.length > 1
      ? `${state.index + 1} / ${state.urls.length}`
      : ''
  }
  const prev = root.querySelector<HTMLElement>('.bvp-viewer__nav--prev')
  const next = root.querySelector<HTMLElement>('.bvp-viewer__nav--next')
  prev?.classList.toggle('is-hidden', state.urls.length <= 1)
  next?.classList.toggle('is-hidden', state.urls.length <= 1)
}

function step(delta: number): void {
  if (!state || state.urls.length <= 1)
    return
  state.index = (state.index + delta + state.urls.length) % state.urls.length
  state.scale = 1
  render()
}

function close(): void {
  root?.remove()
  root = null
  state = null
  document.removeEventListener('keydown', onKeyDown, true)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape')
    close()
  else if (event.key === 'ArrowLeft')
    step(-1)
  else if (event.key === 'ArrowRight')
    step(1)
  else if (event.key === '+' || event.key === '=')
    zoom(0.2)
  else if (event.key === '-')
    zoom(-0.2)
  else
    return
  event.preventDefault()
  event.stopPropagation()
}

function zoom(delta: number): void {
  if (!state)
    return
  state.scale = Math.min(4, Math.max(0.4, state.scale + delta))
  render()
}

function build(): HTMLElement {
  const shell = document.createElement('div')
  shell.className = 'bvp-viewer'
  shell.id = VIEWER_ID

  const img = document.createElement('img')
  img.className = 'bvp-viewer__img'
  img.alt = ''
  img.referrerPolicy = 'no-referrer'

  const counter = document.createElement('div')
  counter.className = 'bvp-viewer__counter'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'bvp-viewer__close'
  closeBtn.title = '关闭（Esc）'
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', close)

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.className = 'bvp-viewer__nav bvp-viewer__nav--prev'
  prev.title = '上一张（←）'
  prev.textContent = '‹'
  prev.addEventListener('click', (event) => {
    event.stopPropagation()
    step(-1)
  })

  const next = document.createElement('button')
  next.type = 'button'
  next.className = 'bvp-viewer__nav bvp-viewer__nav--next'
  next.title = '下一张（→）'
  next.textContent = '›'
  next.addEventListener('click', (event) => {
    event.stopPropagation()
    step(1)
  })

  shell.append(img, counter, closeBtn, prev, next)
  // 点击空白关闭；滚轮缩放
  shell.addEventListener('click', (event) => {
    if (event.target === shell)
      close()
  })
  shell.addEventListener('wheel', (event) => {
    event.preventDefault()
    zoom(event.deltaY > 0
      ? -0.15
      : 0.15)
  }, { passive: false })
  img.addEventListener('click', event => event.stopPropagation())
  return shell
}

/** 打开预览层；urls 里第 index 张开始 */
export function openImageViewer(urls: string[], index = 0): void {
  if (!urls.length)
    return
  close()
  root = build()
  state = {
    urls,
    index: Math.min(Math.max(0, index), urls.length - 1),
    scale: 1,
  }
  document.body.appendChild(root)
  render()
  document.addEventListener('keydown', onKeyDown, true)
}

/** 卸载（页面切走时清理） */
export function closeImageViewer(): void {
  close()
}
