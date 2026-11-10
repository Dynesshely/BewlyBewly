import { expect, test } from '@playwright/test'

import { launchExtension, openHomeFixture, readExtensionState, skipIfExtensionMissing } from './utils'

test.describe('扩展挂载冒烟测试', () => {
  skipIfExtensionMissing()

  test('在 B 站首页 fixture 上挂载 #bewly', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()

      // 本地快照 + 统一就绪 helper（host 可见 / shadow root 注入样式）
      await openHomeFixture(page)

      const state = await readExtensionState(page)
      expect(state.hostExists).toBe(true)
      expect(state.hasShadowRoot).toBe(true)
      expect(state.hasWrapper).toBe(true)
    }
    finally {
      await context.close()
    }
  })
})
