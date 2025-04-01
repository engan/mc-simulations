import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import TestWasm from '../TestWasm.vue'

describe('TestWasm', () => {
  it('renders properly', () => {
    const wrapper = mount(TestWasm, { props: { msg: 'Hello Vitest' } })
    expect(wrapper.text()).toContain('Hello Vitest')
  })
})
