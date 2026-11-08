/**
 * 共享周期任务调度器。
 *
 * - 全页面只保留一个 setTimeout，避免每个轮询各自持有定时器；
 * - 页面隐藏（document.hidden）时暂停所有周期任务；
 * - 切回可见时，过期任务只补跑一次，不会连发；
 * - 到期时间相近（小于 max(60ms, 周期 / 10)）的任务合并到同一次唤醒执行。
 */
interface Task {
  ms: number
  fn: () => void
  due: number
  hidden: boolean
  dead: boolean
}

const tasks = new Set<Task>()
let timer = 0
let at = Number.POSITIVE_INFINITY
let bound = false

function runnable(task: Task): boolean {
  return !task.dead && (task.hidden || !document.hidden)
}

function arm(): void {
  let next = Number.POSITIVE_INFINITY
  for (const task of tasks) {
    if (runnable(task) && task.due < next)
      next = task.due
  }
  if (next === at && timer)
    return
  clearTimeout(timer)
  timer = 0
  at = next
  if (next === Number.POSITIVE_INFINITY)
    return
  timer = window.setTimeout(fire, Math.max(0, next - performance.now()))
}

function fire(): void {
  timer = 0
  at = Number.POSITIVE_INFINITY
  const now = performance.now()
  for (const task of [...tasks]) {
    if (!runnable(task))
      continue
    const slack = Math.max(60, task.ms / 10)
    if (task.due - now > slack)
      continue
    task.due = now + task.ms
    try {
      task.fn()
    }
    catch (e) {
      console.error('[BewlyBewly] scheduled task failed', e)
    }
  }
  arm()
}

function bind(): void {
  if (bound)
    return
  bound = true
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const now = performance.now()
      for (const task of tasks) {
        if (task.due < now)
          task.due = now
      }
    }
    arm()
  })
}

/**
 * 每隔 ms 执行一次 fn（页面隐藏时暂停）。
 * @returns 取消函数
 */
export function every(ms: number, fn: () => void, options: { hidden?: boolean, immediate?: boolean } = {}): () => void {
  bind()
  const task: Task = {
    ms,
    fn,
    due: performance.now() + (options.immediate ? 0 : ms),
    hidden: !!options.hidden,
    dead: false,
  }
  tasks.add(task)
  arm()
  return () => {
    task.dead = true
    tasks.delete(task)
    arm()
  }
}
