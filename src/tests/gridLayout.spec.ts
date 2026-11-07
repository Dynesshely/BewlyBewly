import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useGridLayoutClass } from '~/composables/useGridLayout'

describe('useGridLayoutClass', () => {
  it('maps grid layout types to css classes', () => {
    const layout = ref<'adaptive' | 'twoColumns' | 'oneColumn'>('adaptive')
    const gridClass = useGridLayoutClass(layout)

    expect(gridClass.value).toBe('grid-adaptive')

    layout.value = 'twoColumns'
    expect(gridClass.value).toBe('grid-two-columns')

    layout.value = 'oneColumn'
    expect(gridClass.value).toBe('grid-one-column')
  })

  it('supports a custom adaptive class', () => {
    const layout = ref<'adaptive' | 'twoColumns' | 'oneColumn'>('adaptive')
    const adaptive = ref('grid-adaptive-video')
    const gridClass = useGridLayoutClass(layout, adaptive)

    expect(gridClass.value).toBe('grid-adaptive-video')

    adaptive.value = 'grid-adaptive-bangumi'
    expect(gridClass.value).toBe('grid-adaptive-bangumi')
  })
})
