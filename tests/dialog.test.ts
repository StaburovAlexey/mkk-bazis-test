import { describe, expect, it } from 'vitest'
import { trapDialogFocus } from '../app/composables/useConfirmDialog'

function dialogFixture() {
  let active: unknown
  const buttons = Array.from({ length: 3 }, () => ({
    hidden: false,
    tabIndex: 0,
    getClientRects: () => [{}],
    focus() { active = this },
  }))
  const dialog = {
    ownerDocument: { get activeElement() { return active } },
    querySelectorAll: () => buttons,
    focus() { active = dialog },
  } as unknown as HTMLDialogElement
  return { dialog, buttons, active: () => active }
}
function tab(shiftKey = false) {
  return { key: 'Tab', shiftKey, defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
}

describe('confirmation dialog focus trap', () => {
  it('cycles Shift+Tab from the first control to the last control', () => {
    const fixture = dialogFixture()
    fixture.buttons[0]!.focus()
    const event = tab(true)
    trapDialogFocus(event, fixture.dialog)
    expect(fixture.active()).toBe(fixture.buttons[2])
    expect(event.defaultPrevented).toBe(true)
  })
  it('cycles Tab from the last control to the first control', () => {
    const fixture = dialogFixture()
    fixture.buttons[2]!.focus()
    const event = tab()
    trapDialogFocus(event, fixture.dialog)
    expect(fixture.active()).toBe(fixture.buttons[0])
    expect(event.defaultPrevented).toBe(true)
  })
  it('allows normal movement between controls and leaves Escape to cancel handling', () => {
    const fixture = dialogFixture()
    fixture.buttons[1]!.focus()
    const event = tab()
    trapDialogFocus(event, fixture.dialog)
    expect(event.defaultPrevented).toBe(false)
    const escape = { ...tab(), key: 'Escape' }
    trapDialogFocus(escape, fixture.dialog)
    expect(escape.defaultPrevented).toBe(false)
  })
})
