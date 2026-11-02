import { computed, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export interface AppButtonProps {
  variant?: 'default' | 'primary' | 'danger' | 'text'
  type?: 'button' | 'submit' | 'reset'
  to?: RouteLocationRaw
  href?: string
  disabled?: boolean
}

export function useAppButton(props: Readonly<AppButtonProps>, linkComponent: Component) {
  const element = computed<string | Component>(() => {
    if (props.to !== undefined) return linkComponent
    return props.href !== undefined ? 'a' : 'button'
  })
  const elementProps = computed(() => {
    if (props.to !== undefined) return { to: props.to }
    if (props.href !== undefined) return { href: props.href }
    return { type: props.type ?? 'button', disabled: props.disabled ?? false }
  })
  const classes = computed(() => ['app-button', `app-button--${props.variant ?? 'default'}`])

  return { element, elementProps, classes }
}
