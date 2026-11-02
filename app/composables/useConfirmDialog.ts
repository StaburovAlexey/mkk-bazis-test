import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  alternativeLabel?: string
  danger?: boolean
}
export type ConfirmationChoice = 'confirm' | 'alternative' | 'cancel'

export function useConfirmation() {
  const dialog = ref<Confirmation | null>(null)
  let resolveChoice: ((choice: ConfirmationChoice) => void) | undefined
  function choose(choice: ConfirmationChoice) {
    dialog.value = null
    resolveChoice?.(choice)
    resolveChoice = undefined
  }
  function ask(config: Confirmation): Promise<ConfirmationChoice> {
    if (resolveChoice) choose('cancel')
    dialog.value = config
    return new Promise(resolve => { resolveChoice = resolve })
  }
  onBeforeUnmount(() => choose('cancel'))
  return { dialog, ask, choose }
}

export function useConfirmDialog(config: () => Confirmation | null, emit: (event: 'choose', choice: ConfirmationChoice) => void) {
  const dialogElement = ref<HTMLDialogElement | null>(null)
  let opener: HTMLElement | null = null
  function restoreFocus() {
    if (opener?.isConnected) opener.focus()
    opener = null
  }
  onMounted(() => {
    watch(config, async value => {
      const element = dialogElement.value
      if (!element) return
      if (!value) {
        element.close()
        restoreFocus()
        return
      }
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      if (!config() || !element.isConnected) return
      if (!element.open) element.showModal()
      element.querySelector<HTMLButtonElement>('[data-safe-focus]')?.focus()
    }, { immediate: true, flush: 'post' })
  })
  function cancel(event: Event) {
    event.preventDefault()
    emit('choose', 'cancel')
  }
  function confirm() { emit('choose', 'confirm') }
  function alternative() { emit('choose', 'alternative') }
  function dismiss() { emit('choose', 'cancel') }
  function keydown(event: KeyboardEvent) {
    if (dialogElement.value) trapDialogFocus(event, dialogElement.value)
  }
  onBeforeUnmount(() => {
    dialogElement.value?.close()
    restoreFocus()
  })
  return { dialogElement, cancel, confirm, alternative, dismiss, keydown }
}

export function trapDialogFocus(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>, dialog: HTMLDialogElement): void {
  if (event.key !== 'Tab') return
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]',
  )).filter(element => !element.hidden && element.tabIndex >= 0 && element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls[controls.length - 1]
  const active = dialog.ownerDocument.activeElement
  if (!first || !last) {
    event.preventDefault()
    dialog.focus()
  } else if (!controls.includes(active as HTMLElement) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault()
    if (event.shiftKey) last.focus()
    else first.focus()
  }
}
