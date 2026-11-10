import { useStorage } from '@vueuse/core'

/**
 * 「页面内粘贴直达」开关（模块内 localStorage，key 前缀 `bewly-`）。
 *
 * 建议 Lead 后续并入 `storage.ts`，字段名 `searchPageDirectPasteEnabled`。
 */
const directPasteEnabled = useStorage<boolean>('bewly-search-direct-paste', true)

export function useDirectPasteSetting() {
  return directPasteEnabled
}
