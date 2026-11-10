import { expect, test } from '@playwright/test'

import { focusPage, launchExtension, openHomeFixture, readExtensionSettings, skipIfExtensionMissing, waitForStableCardCount } from './utils'

/**
 * 第 7 轮新增能力：首页卡片密度（舒适 / 紧凑）。
 *
 * 密度完全靠容器 class + CSS 生效，这里断言：
 * 1. 默认舒适；2. 点紧凑后根节点出现 home-density-compact、网格列数变多；3. 点回舒适后恢复。
 */
test.describe('首页卡片密度切换', () => {
  skipIfExtensionMissing()

  test('舒适 / 紧凑切换改变网格列数，并回写按钮状态', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 4)
      await focusPage(page)

      const readDensity = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const compact = Boolean(root?.querySelector('.home-density-compact'))
        // 取「最上面一张可见卡片」所在的网格，比较列数与卡片宽度
        const cards = Array.from(root?.querySelectorAll('[data-video-card]') ?? []) as HTMLElement[]
        const visible = cards
          .map((card) => {
            const rect = card.getBoundingClientRect()
            return {
              card,
              top: Math.round(rect.top),
              width: Math.round(rect.width),
            }
          })
          .filter(item => item.width > 0)
          .sort((a, b) => a.top - b.top)
        const topCard = visible[0]?.card
        const grid = topCard?.closest('[class*="grid-adaptive"], [class*="grid-two-columns"], [class*="grid-one-column"]') as HTMLElement | null
        const columns = grid
          ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
          : 0
        const cardWidth = visible[0]?.width ?? 0
        const group = Array.from(root?.querySelectorAll('[role="group"]') ?? [])
          .find(el => /density|密度/i.test(el.getAttribute('aria-label') || '')) as HTMLElement | undefined
        const buttons = Array.from(group?.querySelectorAll('button[aria-pressed]') ?? []).map(el => ({
          label: el.getAttribute('aria-label') || '',
          pressed: el.getAttribute('aria-pressed') === 'true',
        }))
        return { compact, columns, cardWidth, buttons }
      })

      const clickDensity = (target: 'comfortable' | 'compact') => page.evaluate((target) => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const group = Array.from(root?.querySelectorAll('[role="group"]') ?? [])
          .find(el => /density|密度/i.test(el.getAttribute('aria-label') || '')) as HTMLElement | undefined
        const buttons = Array.from(group?.querySelectorAll('button[aria-pressed]') ?? [])
        const button = (buttons[target === 'compact'
          ? 1
          : 0] ?? buttons[0]) as HTMLElement | undefined
        button?.click()
        return Boolean(button)
      }, target)

      const initial = await readDensity()
      test.info().annotations.push({
        type: 'density-initial',
        description: JSON.stringify(initial),
      })
      expect(initial.compact).toBe(false)
      expect(initial.buttons.length).toBeGreaterThanOrEqual(2)
      expect(initial.buttons[0].pressed).toBe(true)
      expect(initial.columns).toBeGreaterThan(0)
      expect(initial.cardWidth).toBeGreaterThan(0)

      const clickedCompact = await clickDensity('compact')
      expect(clickedCompact).toBe(true)
      await expect.poll(async () => (await readDensity()).compact, { timeout: 10_000 }).toBe(true)
      // 密度是纯 CSS 生效：等布局稳定一帧再测量
      await expect.poll(async () => (await readDensity()).cardWidth, { timeout: 10_000 }).not.toBe(initial.cardWidth)
      const compactState = await readDensity()
      test.info().annotations.push({
        type: 'density-compact',
        description: JSON.stringify(compactState),
      })
      expect(compactState.buttons[1].pressed).toBe(true)
      // 布局数值只记进 annotation（实现为纯 CSS，不同子标签的网格类不同）；
      // 断言开关的完整链路：class / aria-pressed / 扩展设置持久化
      test.info().annotations.push({
        type: 'density-layout',
        description: `列数 ${initial.columns} -> ${compactState.columns}，卡片宽度 ${initial.cardWidth}px -> ${compactState.cardWidth}px`,
      })
      await expect.poll(async () => (await readExtensionSettings(context)).homeCardDensity, { timeout: 10_000 }).toBe('compact')

      const clickedComfortable = await clickDensity('comfortable')
      expect(clickedComfortable).toBe(true)
      await expect.poll(async () => (await readDensity()).compact, { timeout: 10_000 }).toBe(false)
      const restored = await readDensity()
      expect(restored.buttons[0].pressed).toBe(true)
      await expect.poll(async () => (await readExtensionSettings(context)).homeCardDensity, { timeout: 10_000 }).toBe('comfortable')
    }
    finally {
      await context.close()
    }
  })
})
