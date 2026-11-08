import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { every } from '~/utils/scheduler'

describe('scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('按周期执行任务', () => {
    const fn = vi.fn()
    const stop = every(1000, fn)
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(3)
    stop()
  })

  it('取消后不再执行', () => {
    const fn = vi.fn()
    const stop = every(500, fn)
    vi.advanceTimersByTime(1000)
    stop()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('一次唤醒合并多个到期任务', () => {
    const a = vi.fn()
    const b = vi.fn()
    const stopA = every(1000, a)
    const stopB = every(1000, b)
    vi.advanceTimersByTime(1000)
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
    stopA()
    stopB()
  })

  it('页面隐藏时暂停，恢复后补跑一次', () => {
    const fn = vi.fn()
    const stop = every(1000, fn)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
  })
})
