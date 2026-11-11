import type { ShortcutRegistryEntry } from '../../src/constants/shortcutRegistry'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 注意：不能用 `~/...` 别名 —— vitest 的 root 是 src/，而本文件在仓库根的 tests/unit/，
// 别名解析不覆盖仓库外的模块；这里统一用相对路径导入被测源码。
import {
  groupShortcutsByScope,
  KEY_SEPARATOR,
  scopeLabelKey,
  SHORTCUT_REGISTRY,
  SHORTCUT_SCOPES,
} from '../../src/constants/shortcutRegistry'
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS } from '../../src/constants/shortcuts'

/**
 * 快捷键注册表兜底校验（第 24 轮）。
 *
 * 四条硬约束（任何一条不满足都说明注册表 / 文案 / 分组有一处漏改）：
 *  1. 同一 scope 内，规范化后的默认键位唯一；
 *  2. 每个 action 都有 scope 与 i18n label key，且 key 在四种语言的 _locales 里都有文案；
 *  3. 键位规范化（大小写 / 修饰键顺序 / 别名）后仍然唯一（与 1 合并校验，但显式区分「原始重复」与「规范化后重复」）；
 *  4. 所有 scope 都在 SHORTCUT_SCOPES（帮助面板分组顺序）里定义，且每个 scope 都有分组标题文案。
 *
 * 失败信息统一带上 entry.id / scope / 键位，便于直接定位到具体 entry。
 */

const LOCALES = ['cmn-CN', 'cmn-TW', 'jyut', 'en'] as const
type Locale = typeof LOCALES[number]

/**
 * _locales 目录。
 *
 * vitest 的 root 是 `src/`（见 vite.config.ts），测试文件在仓库根的 `tests/unit/`，
 * 因此 `import.meta.url` 会被 Vite 处理成 http URL —— 不能用 `fileURLToPath`。
 * 这里统一从 `process.cwd()`（`pnpm test` 的工作目录 = 仓库根）解析，找不到再向上找一层。
 */
function resolveLocalesDir(): string {
  const candidates = [
    join(process.cwd(), 'src', '_locales'),
    join(process.cwd(), '..', 'src', '_locales'),
  ]
  const found = candidates.find(dir => existsSync(join(dir, 'cmn-CN.yml')))
  if (!found)
    throw new Error(`找不到 _locales 目录，已尝试：\n${candidates.join('\n')}`)
  return found
}

const LOCALES_DIR = resolveLocalesDir()

/** 修饰键规范顺序（与 src/constants/shortcuts.ts 的约定一致） */
const MODIFIER_ORDER = ['ctrl', 'meta', 'alt', 'shift'] as const

/** 不需要展示、仅用于「范围」的分隔符 */
const RANGE_SEPARATOR = KEY_SEPARATOR

interface FailureCollector {
  failures: string[]
  add: (message: string) => void
}

function createCollector(): FailureCollector {
  const failures: string[] = []
  return {
    failures,
    add: (message: string) => {
      if (!failures.includes(message))
        failures.push(message)
    },
  }
}

/** 极简 YAML 扁平化（只支持本仓库 _locales 用到的「缩进 + key: value」结构） */
function flattenYaml(filePath: string): Map<string, string> {
  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/)
  const map = new Map<string, string>()
  const stack: Array<{ indent: number, key: string }> = []

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#'))
      continue
    // 不用 \s* 同时匹配前后缀（正则回溯风险）：手动切出缩进与「key: value」
    const indentMatch = line.match(/^[ \t]*/)
    const body = line.slice(indentMatch ? indentMatch[0].length : 0)
    const colonIndex = body.indexOf(':')
    if (colonIndex <= 0)
      continue
    const key = body.slice(0, colonIndex).trim()
    const value = body.slice(colonIndex + 1)
    const indent = indentMatch ? indentMatch[0].length : 0
    while (stack.length && stack[stack.length - 1].indent >= indent)
      stack.pop()

    const path = [
      ...stack.map(item => item.key),
      key,
    ].join('.')
    if (value.trim() === '') {
      stack.push({ indent, key })
      continue
    }
    // 去掉包裹的引号，避免 "..." / '...' 影响「是否为空」的判断
    map.set(path, value.trim().replace(/^(['"])(.*)\1$/, '$2'))
  }
  return map
}

const localeDicts: Record<Locale, Map<string, string>> = Object.fromEntries(
  LOCALES.map(locale => [
    locale,
    flattenYaml(join(LOCALES_DIR, `${locale}.yml`)),
  ]),
) as Record<Locale, Map<string, string>>

/** 规范修饰键：Cmd / Command → Meta；大小写不敏感 */
function normalizeModifier(token: string): string {
  const lower = token.toLowerCase()
  if (lower === 'cmd' || lower === 'command' || lower === 'meta' || lower === 'win' || lower === 'super')
    return 'meta'
  if (lower === 'ctrl' || lower === 'control')
    return 'ctrl'
  if (lower === 'opt' || lower === 'option' || lower === 'alt')
    return 'alt'
  if (lower === 'shift')
    return 'shift'
  return lower
}

/** 规范主键：单字母统一小写，Space 统一写法，方向键保留原样 */
function normalizeKey(token: string): string {
  const trimmed = token.trim()
  if (trimmed === ' ' || trimmed.toLowerCase() === 'space')
    return 'space'
  if (trimmed.length === 1)
    return trimmed.toLowerCase()
  return trimmed.toLowerCase()
}

/** 一个组合键 → 规范化字符串（修饰键按 Ctrl→Meta→Alt→Shift 排序并去重） */
function normalizeCombo(combo: string): string {
  const parts = combo.split('+').map(part => part.trim()).filter(Boolean)
  if (!parts.length)
    return ''
  const modifiers = parts
    .filter(part => [
      'ctrl',
      'meta',
      'alt',
      'shift',
      'cmd',
      'command',
      'control',
      'opt',
      'option',
      'win',
      'super',
    ].includes(part.toLowerCase()))
    .map(normalizeModifier)
  const keys = parts.filter(part => !modifiers.includes(normalizeModifier(part)))
  const orderedModifiers = MODIFIER_ORDER.filter(modifier => modifiers.includes(modifier))
  return [
    ...orderedModifiers,
    ...keys.map(normalizeKey),
  ].join('+')
}

/** 把 [0, '–', 9] 这种范围展开成 ['0'..'9']；不是范围就原样返回 */
function expandRange(tokens: string[]): string[][] {
  if (tokens.length === 3 && tokens[1] === RANGE_SEPARATOR) {
    const start = tokens[0]
    const end = tokens[2]
    if (/^\d$/.test(start) && /^\d$/.test(end)) {
      const from = Number(start)
      const to = Number(end)
      const step = from <= to
        ? 1
        : -1
      const items: string[][] = []
      for (let value = from; step > 0
        ? value <= to
        : value >= to; value += step) {
        items.push([
          String(value),
        ])
      }
      return items
    }
  }
  return [tokens]
}

/** 一个 entry 实际占用的规范化键位列表（chord 组合成一条，非 chord 的每个片段各算一条） */
function entryCombos(entry: ShortcutRegistryEntry): string[] {
  if (entry.shortcutActionId) {
    const combo = DEFAULT_SHORTCUTS[entry.shortcutActionId]
    const normalized = normalizeCombo(combo)
    return normalized
      ? [normalized]
      : []
  }

  const groups = expandRange(entry.keys)
  // 组合键（chord）：整组按一个组合键处理，例如 ['Shift','P'] → shift+p
  if (entry.chord)
    return groups.map(group => normalizeCombo(group.join('+')))

  // 非组合键：keys 之间是「或」，范围（0–9 / 1–4）已展开成多个单键
  const combos: string[] = []
  for (const group of groups) {
    for (const token of group) {
      if (token === RANGE_SEPARATOR)
        continue
      const combo = normalizeCombo(token)
      if (combo)
        combos.push(combo)
    }
  }
  return [
    ...new Set(combos),
  ]
}

/** 枚举 entry 的「原始键位」字符串，用于区分「原始重复」与「规范化后重复」 */
function rawCombos(entry: ShortcutRegistryEntry): string[] {
  if (entry.shortcutActionId) {
    const combo = DEFAULT_SHORTCUTS[entry.shortcutActionId]
    return combo
      ? [combo]
      : []
  }
  const groups = expandRange(entry.keys)
  return groups.map(group => group.join(entry.chord ? '+' : ' / '))
}

function formatEntry(entry: ShortcutRegistryEntry): string {
  return `[${entry.id}] scope=${entry.scope} keys=${rawCombos(entry).join(' , ')} i18nKey=${entry.i18nKey}`
}

/**
 * 收集「同一 scope 内键位冲突」。
 *
 * @param entries 待校验的登记表（测试用合成数据时可直接传）
 * @param mode raw = 原始键位；normalized = 规范化后的键位
 */
function collectKeyConflicts(
  entries: ShortcutRegistryEntry[],
  mode: 'raw' | 'normalized',
): string[] {
  const failures: string[] = []
  const seen = new Map<string, string>()

  for (const entry of entries) {
    const combos = mode === 'raw'
      ? rawCombos(entry)
      : entryCombos(entry)
    for (const combo of combos) {
      const key = `${entry.scope}::${combo}`
      const previous = seen.get(key)
      if (previous) {
        const label = mode === 'raw'
          ? '原始'
          : '规范化后'
        failures.push(`键位冲突（${label}）：scope=${entry.scope} 组合键「${combo}」被 ${previous} 与 ${formatEntry(entry)} 同时占用`)
        continue
      }
      seen.set(key, formatEntry(entry))
    }
  }

  return failures
}

describe('shortcutRegistry 兜底校验', () => {
  describe('1. 同一 scope 内默认键位唯一', () => {
    it('原始键位没有重复（同一 scope）', () => {
      const failures = collectKeyConflicts(SHORTCUT_REGISTRY, 'raw')
      expect(failures, `\n${failures.join('\n')}\n`).toEqual([])
    })

    it('规范化（大小写 / 修饰键顺序 / Cmd↔Meta）后仍然没有重复', () => {
      const failures = collectKeyConflicts(SHORTCUT_REGISTRY, 'normalized')
      expect(failures, `\n${failures.join('\n')}\n`).toEqual([])
    })
  })

  describe('2. 每个 action 的 scope / label key / 四语言文案齐全', () => {
    it('scope 与 label key 字段非空，且 shortcutActionId 指向已登记的动作', () => {
      const collector = createCollector()
      const actionIds = new Set(SHORTCUT_ACTIONS.map(action => action.id))
      const scopes = new Set<string>(SHORTCUT_SCOPES)

      for (const entry of SHORTCUT_REGISTRY) {
        if (!entry.scope)
          collector.add(`[${entry.id}] 缺少 scope`)
        else if (!scopes.has(entry.scope))
          collector.add(`[${entry.id}] 的 scope「${entry.scope}」不在 SHORTCUT_SCOPES 里（帮助面板分组顺序未定义该分组）`)

        if (!entry.i18nKey)
          collector.add(`[${entry.id}] 缺少 i18nKey（label key）`)

        if (!entry.keys?.length && !entry.shortcutActionId)
          collector.add(`[${entry.id}] 既没有 keys 也没有 shortcutActionId，无法展示键位`)

        if (entry.shortcutActionId && !actionIds.has(entry.shortcutActionId))
          collector.add(`[${entry.id}] 的 shortcutActionId「${entry.shortcutActionId}」没有在 SHORTCUT_ACTIONS 里登记`)
      }

      // 反向：登记过的可自定义动作都应在注册表里出现，否则帮助面板会漏展示
      const referenced = new Set(SHORTCUT_REGISTRY.map(entry => entry.shortcutActionId).filter(Boolean))
      for (const action of SHORTCUT_ACTIONS) {
        if (!referenced.has(action.id))
          collector.add(`可自定义动作「${action.id}」没有出现在 SHORTCUT_REGISTRY 里（帮助面板 / 命令面板会漏掉它）`)
      }

      expect(collector.failures, `\n${collector.failures.join('\n')}\n`).toEqual([])
    })

    it('每个 i18nKey 在四种语言的 _locales 里都有非空文案', () => {
      const collector = createCollector()

      for (const entry of SHORTCUT_REGISTRY) {
        if (!entry.i18nKey)
          continue
        for (const locale of LOCALES) {
          const text = localeDicts[locale].get(entry.i18nKey)
          if (!text || !text.trim())
            collector.add(`[${entry.id}] 缺少文案：locale=${locale} key=${entry.i18nKey}`)
        }
      }

      expect(collector.failures, `\n${collector.failures.join('\n')}\n`).toEqual([])
    })
  })

  describe('3. 帮助面板分组顺序覆盖所有 scope', () => {
    it('sHORTCUT_SCOPES 无重复，且包含注册表里出现的所有 scope', () => {
      const collector = createCollector()
      const duplicates = SHORTCUT_SCOPES.filter((scope, index) => SHORTCUT_SCOPES.indexOf(scope) !== index)
      for (const scope of duplicates)
        collector.add(`SHORTCUT_SCOPES 里 scope「${scope}」重复定义（分组顺序会有歧义）`)

      for (const entry of SHORTCUT_REGISTRY) {
        if (!SHORTCUT_SCOPES.includes(entry.scope))
          collector.add(`[${entry.id}] 的 scope「${entry.scope}」没有出现在 SHORTCUT_SCOPES（帮助面板分组顺序）里`)
      }

      expect(collector.failures, `\n${collector.failures.join('\n')}\n`).toEqual([])
    })

    it('每个 scope 都有分组标题文案，且分组结果与 SHORTCUT_SCOPES 的顺序一致', () => {
      const collector = createCollector()

      for (const scope of SHORTCUT_SCOPES) {
        const labelKey = scopeLabelKey(scope)
        for (const locale of LOCALES) {
          const text = localeDicts[locale].get(labelKey)
          if (!text || !text.trim())
            collector.add(`scope「${scope}」缺少分组标题文案：locale=${locale} key=${labelKey}`)
        }
      }

      const groups = groupShortcutsByScope()
      const expectedOrder = SHORTCUT_SCOPES.filter(scope => groups.some(group => group.scope === scope))
      const actualOrder = groups.map(group => group.scope)
      if (actualOrder.join(',') !== expectedOrder.join(','))
        collector.add(`帮助面板分组顺序与 SHORTCUT_SCOPES 不一致：期望 ${expectedOrder.join(' → ')}，实际 ${actualOrder.join(' → ')}`)

      for (const group of groups) {
        if (!group.entries.length)
          collector.add(`scope「${group.scope}」的分组为空，不应出现在帮助面板里`)
      }

      expect(collector.failures, `\n${collector.failures.join('\n')}\n`).toEqual([])
    })
  })

  describe('4. 规范化函数自身的回归（避免校验器假绿）', () => {
    it('修饰键顺序 / 别名 / 大小写都能被规范化', () => {
      expect(normalizeCombo('Shift+Ctrl+k')).toBe('ctrl+shift+k')
      expect(normalizeCombo('Ctrl+Shift+K')).toBe('ctrl+shift+k')
      expect(normalizeCombo('Cmd+k')).toBe('meta+k')
      expect(normalizeCombo('Meta+K')).toBe('meta+k')
      expect(normalizeCombo('Space')).toBe('space')
      expect(normalizeCombo('?')).toBe('?')
    })

    it('冲突能被检出，且失败信息带具体 action id', () => {
      const fakeEntries = [
        {
          id: 'fake-a',
          scope: 'list',
          keys: ['V'],
          i18nKey: 'keyboard_registry.actions.list_cycle_view',
        },
        {
          id: 'fake-b',
          scope: 'list',
          keys: ['v'],
          i18nKey: 'keyboard_registry.actions.list_cycle_sort',
        },
        {
          id: 'fake-c',
          scope: 'list',
          keys: ['Shift', 'V'],
          chord: true,
          i18nKey: 'keyboard_registry.actions.list_cycle_view',
        },
      ] as ShortcutRegistryEntry[]

      // 原始键位：V 与 v 大小写不同，只有 fake-c 与 fake-a 的「Shift+V」不冲突
      expect(collectKeyConflicts(fakeEntries, 'raw')).toEqual([])
      // 规范化后 V / v → v：fake-a 与 fake-b 冲突，且信息里能看到具体 id
      const failures = collectKeyConflicts(fakeEntries, 'normalized')
      expect(failures).toHaveLength(1)
      expect(failures[0]).toContain('[fake-a]')
      expect(failures[0]).toContain('[fake-b]')
      expect(failures[0]).toContain('scope=list')
    })

    it('范围键位会被展开（0–9 / 1–4）', () => {
      const percentEntry = SHORTCUT_REGISTRY.find(entry => entry.id === 'video-percent')
      expect(percentEntry, 'video-percent entry 应该存在').toBeTruthy()
      const combos = entryCombos(percentEntry!)
      expect(combos).toContain('5')
      expect(combos).toHaveLength(10)

      const categoryEntry = SHORTCUT_REGISTRY.find(entry => entry.id === 'notification-jump-category')
      expect(categoryEntry, 'notification-jump-category entry 应该存在').toBeTruthy()
      expect(entryCombos(categoryEntry!)).toEqual(['1', '2', '3', '4'])
    })
  })
})
