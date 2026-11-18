/**
 * 「可撤销」的操作反馈。
 *
 * # 问题
 *
 * 第 8~19 轮把「稍后再看 / 收藏」做成了卡片上的一个点击，但**移除类操作是不可逆的**：
 * 点一下「稍后再看」直接把条目从列表里删掉，只弹一句「已从稍后再看移除」。
 * 用户手滑、或者只是想确认某个视频还在不在，就得回 B 站页面重新找回来 ——
 * 这正是「心智负担」：每次点删除前都要先掂量「删错了怎么办」。
 *
 * # 做法
 *
 * 撤销窗口内（默认 6 秒）挂一条**带操作按钮**的 toast：
 *   - 用户点「撤销」→ 执行回滚，并再给一条「已撤销」；
 *   - 窗口内用户没动 → toast 自动消失，操作就是最终结果（与现状一致，不额外弹二次确认）；
 *   - 同一个操作重复触发时只有最后一条撤销 toast 有效（`key` 去重，避免连点叠一堆）。
 *
 * # 为什么用内联样式
 *
 * toast 容器有两类宿主：主 App 在 `#bewly` 的 **shadow root** 里，而自绘页
 * （空间 / 搜索 / 热门 / 分区 / 消息）由 mount.ts 各自 `createApp + setupApp`，
 * 宿主在 **light DOM**。同一个 class 不可能同时在两处命中样式表，
 * 所以按钮与排版一律走内联样式，只借 toast 容器的圆角与配色。
 *
 * # 边界
 *
 * - 撤销本身失败会明确提示「撤销失败」，不静默吞掉；
 * - 按钮是原生 `button` + `aria-label`，键盘可达（toast 不会抢焦点，Tab 能走到）；
 * - 不依赖页面结构，自绘页与原生页都能用。
 */
import { h } from 'vue'
import { useToast } from 'vue-toastification'

/** toast 的 id 类型（vue-toastification 没把它从入口导出，这里按实际结构取） */
type ToastID = ReturnType<ReturnType<typeof useToast>['info']>

export interface UndoableActionOptions {
  /** 去重 key：同一个 key 的撤销窗口只保留最后一条 */
  key: string
  /** 主提示（已完成的操作，如「已从稍后再看移除」） */
  message: string
  /** 撤销按钮文案 */
  undoLabel: string
  /** 撤销成功提示 */
  undoneLabel: string
  /** 撤销失败提示 */
  undoFailedLabel: string
  /** 点击「撤销」时执行的回滚；返回 false 视为失败 */
  onUndo: () => Promise<boolean> | boolean
  /** 撤销窗口（毫秒），默认 6000 */
  timeout?: number
}

/** 正在等待撤销的操作（key → toast id） */
const pending = new Map<string, ToastID>()

/**
 * 弹一条可撤销的 toast。
 *
 * 返回 `true` 表示用户点了撤销且回滚成功，`false` 表示窗口过期 / 回滚失败。
 * 调用方一般不需要 await（fire-and-forget），返回值只给需要串行处理的场景。
 */
export function showUndoableToast(options: UndoableActionOptions): Promise<boolean> {
  const toast = useToast()
  const timeout = options.timeout ?? 6000

  // 同一 key 的旧窗口先关掉：连点时只保留最后一次，避免一屏堆着好几条撤销
  const previous = pending.get(options.key)
  if (previous !== undefined) {
    try {
      toast.dismiss(previous)
    }
    catch {
      // toast 已经自动关闭时 dismiss 可能抛错，忽略
    }
    pending.delete(options.key)
  }

  return new Promise<boolean>((resolve) => {
    let settled = false
    const settle = (value: boolean) => {
      if (settled)
        return
      settled = true
      pending.delete(options.key)
      resolve(value)
    }

    const id = toast.info({
      component: {
        render: () => h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: '0',
            },
          },
          [
            h(
              'span',
              {
                style: {
                  flex: '1 1 auto',
                  minWidth: '0',
                  overflowWrap: 'anywhere',
                },
              },
              options.message,
            ),
            h(
              'button',
              {
                type: 'button',
                'aria-label': options.undoLabel,
                style: {
                  flex: 'none',
                  padding: '3px 10px',
                  border: '1px solid currentcolor',
                  borderRadius: '999px',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  cursor: 'pointer',
                },
                onClick: async (event: MouseEvent) => {
                  event.stopPropagation()
                  try {
                    toast.dismiss(id)
                  }
                  catch {
                    // 同上
                  }
                  let ok = false
                  try {
                    ok = await options.onUndo()
                  }
                  catch {
                    ok = false
                  }
                  if (ok)
                    toast.success(options.undoneLabel)
                  else
                    toast.error(options.undoFailedLabel)
                  settle(ok)
                },
              },
              options.undoLabel,
            ),
          ],
        ),
      },
    }, {
      timeout,
      closeOnClick: false,
      pauseOnHover: true,
      // 主提示自己带操作按钮，不再叠一个关闭叉
      closeButton: false,
      // 关闭（超时 / 手动）时把 promise 结束掉，调用方不会悬挂
      onClose: () => settle(false),
    })
    pending.set(options.key, id)
  })
}

/** 调试 / 测试用：清空等待中的撤销窗口 */
export function resetUndoableToasts(): void {
  pending.clear()
}
