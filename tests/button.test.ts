import { defineComponent, reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { useAppButton, type AppButtonProps } from '../app/composables/useAppButton'

const Link = defineComponent({ name: 'Link' })

describe('AppButton root behavior', () => {
  it('defaults to a native button with a non-submitting type', () => {
    const { element, elementProps } = useAppButton(reactive<AppButtonProps>({}), Link)

    expect(element.value).toBe('button')
    expect(elementProps.value).toMatchObject({ type: 'button' })
    expect(elementProps.value.disabled ?? false).toBe(false)
  })

  it('preserves an explicit submit type and native disabled state', () => {
    const { element, elementProps } = useAppButton(reactive<AppButtonProps>({ type: 'submit', disabled: true }), Link)

    expect(element.value).toBe('button')
    expect(elementProps.value).toMatchObject({ type: 'submit', disabled: true })
  })

  it('uses the link component for route destinations', () => {
    const { element, elementProps } = useAppButton(reactive<AppButtonProps>({
      to: { path: '/notes/123', query: { edit: '1' } },
      href: 'https://example.com',
      type: 'submit',
      disabled: true,
    }), Link)

    expect(element.value).toBe(Link)
    expect(elementProps.value).toMatchObject({ to: { path: '/notes/123', query: { edit: '1' } } })
  })

  it('uses a native anchor for href destinations', () => {
    const { element, elementProps } = useAppButton(reactive<AppButtonProps>({
      href: 'https://example.com', type: 'reset', disabled: true,
    }), Link)

    expect(element.value).toBe('a')
    expect(elementProps.value).toMatchObject({ href: 'https://example.com' })
  })

  it('updates the root and its attributes when destinations and button type change', () => {
    const props = reactive<AppButtonProps>({ to: '/notes/first' })
    const { element, elementProps } = useAppButton(props, Link)

    expect(elementProps.value).toMatchObject({ to: '/notes/first' })
    props.to = '/notes/second'
    expect(elementProps.value).toMatchObject({ to: '/notes/second' })

    props.to = undefined
    props.href = 'https://example.com'
    expect(element.value).toBe('a')
    expect(elementProps.value).toMatchObject({ href: 'https://example.com' })

    props.href = undefined
    props.type = 'reset'
    props.disabled = true
    expect(element.value).toBe('button')
    expect(elementProps.value).toMatchObject({ type: 'reset', disabled: true })

    props.type = 'submit'
    props.disabled = false
    expect(elementProps.value).toMatchObject({ type: 'submit' })
    expect(elementProps.value.disabled ?? false).toBe(false)
  })
})
