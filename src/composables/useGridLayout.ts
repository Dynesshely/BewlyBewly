import type { Ref } from 'vue'

import type { GridLayoutType } from '~/logic'

/**
 * Shared grid layout class resolver used by the Home sub pages.
 *
 * @param gridLayout the active grid layout
 * @param adaptiveClass class used when layout is 'adaptive' (some pages have variants)
 */
export function useGridLayoutClass(
  gridLayout: Ref<GridLayoutType>,
  adaptiveClass: Ref<string> | string = 'grid-adaptive',
): Ref<string> {
  return computed(() => {
    if (gridLayout.value === 'adaptive') {
      return typeof adaptiveClass === 'string'
        ? adaptiveClass
        : adaptiveClass.value
    }

    if (gridLayout.value === 'twoColumns')
      return 'grid-two-columns'

    return 'grid-one-column'
  })
}
