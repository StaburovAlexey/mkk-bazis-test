import { describe, expect, it } from 'vitest'
import { historyShortcut } from '../app/composables/useNoteEditor'

const key = (changes = {}) => ({ key: 'z', code: 'KeyZ', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: false, ...changes })

describe('editor history shortcuts', () => {
  it('uses the physical Z key with Russian keyboard layout', () => {
    expect(historyShortcut(key({ key: 'я' }))).toBe('undo')
    expect(historyShortcut(key({ key: 'Я', shiftKey: true }))).toBe('redo')
  })
  it('supports Command and keeps unrelated keys untouched', () => {
    expect(historyShortcut(key({ ctrlKey: false, metaKey: true }))).toBe('undo')
    expect(historyShortcut(key({ ctrlKey: false }))).toBeNull()
    expect(historyShortcut(key({ key: 'x', code: 'KeyX' }))).toBeNull()
    expect(historyShortcut(key({ altKey: true }))).toBeNull()
  })
  it('does not steal undo while composing or while a modal is open', () => {
    expect(historyShortcut(key({ isComposing: true }))).toBeNull()
    expect(historyShortcut(key(), true)).toBeNull()
  })
})

import { afterEach, vi } from 'vitest'
import { createRenderer, defineComponent, h, nextTick } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useNoteEditor } from '../app/composables/useNoteEditor'
import { useNotesStore } from '../app/stores/notes'
import { NOTES_KEY } from '../app/composables/useNotesState'
import { draftKey } from '../app/composables/useNoteDraft'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

interface RenderNode { children: RenderNode[]; parent?: RenderNode; getRootNode: () => object }
const renderRoot = {}
const renderNode = (): RenderNode => ({ children: [], getRootNode: () => renderRoot })
const renderer = createRenderer<RenderNode, RenderNode>({
  createElement: renderNode,
  createText: renderNode,
  createComment: renderNode,
  insert(node, parent) { node.parent = parent; parent.children.push(node) },
  remove(node) { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node) },
  parentNode: node => node.parent ?? null,
  nextSibling: () => null,
  setText() {}, setElementText() {}, patchProp() {},
})
const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function editorHarness(options: { existing?: boolean; draft?: boolean } = {}) {
  const local = new MemoryStorage()
  const session = new MemoryStorage()
  const windowTarget = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session })
  const documentTarget = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => null, getElementById: () => null })
  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('document', documentTarget)
  const saved = { id: 'saved', title: 'Сохранено', todos: [{ id: 'todo', text: 'Задача', completed: false }] }
  if (options.existing) local.setItem(NOTES_KEY, JSON.stringify({ version: 1, notes: [saved] }))
  const id = options.existing ? 'saved' : 'new'
  if (options.draft) session.setItem(draftKey(id), JSON.stringify({ version: 1, note: { ...saved, title: 'Черновик' } }))
  let editor!: ReturnType<typeof useNoteEditor>
  const Editor = defineComponent({ setup() { editor = useNoteEditor(); return () => null } })
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: defineComponent({ render: () => null }) },
    { path: '/notes/:id', component: Editor },
  ] })
  const pinia = createPinia()
  const app = renderer.createApp(defineComponent({ render: () => h(RouterView) }))
  app.use(pinia).use(router)
  await router.push(`/notes/${id}`)
  await router.isReady()
  app.mount(renderNode())
  await nextTick()
  const store = useNotesStore(pinia)
  cleanups.push(() => { app.unmount(); disposePinia(pinia) })
  return { editor, store, local, session, windowTarget, documentTarget, router, id }
}

describe('editor integration', () => {
  it('edits a copy and returns to a clean state when the edit is undone', async () => {
    const { editor, store } = await editorHarness({ existing: true })
    editor.setTitle('Изменено')
    expect(store.notes[0]?.title).toBe('Сохранено')
    expect(editor.dirty).toBe(true)
    editor.undo()
    expect(editor.dirty).toBe(false)
  })
  it('suppresses native undo even with an empty application history', async () => {
    const { editor, windowTarget } = await editorHarness()
    const event = Object.assign(new Event('keydown', { cancelable: true }), key())
    windowTarget.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    editor.compositionStart()
    const compositionEvent = Object.assign(new Event('keydown', { cancelable: true }), key())
    windowTarget.dispatchEvent(compositionEvent)
    expect(compositionEvent.defaultPrevented).toBe(false)
  })
  it('keeps a draft untouched until the restoration choice', async () => {
    vi.useFakeTimers()
    const { editor, session, id } = await editorHarness({ existing: true, draft: true })
    const before = session.getItem(draftKey(id))
    expect(editor.ready).toBe(false)
    await vi.runOnlyPendingTimersAsync()
    expect(session.getItem(draftKey(id))).toBe(before)
    editor.choose('confirm')
    await nextTick()
    expect(editor.note.title).toBe('Черновик')
    expect(editor.canUndo).toBe(false)
    expect(editor.dirty).toBe(true)
  })
  it('flushes the pending draft on pagehide', async () => {
    const { editor, session, windowTarget, id } = await editorHarness({ existing: true })
    editor.setTitle('Перед закрытием')
    windowTarget.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(session.getItem(draftKey(id))!).note.title).toBe('Перед закрытием')
  })
  it('retries a failed draft write when the page is hidden', async () => {
    vi.useFakeTimers()
    const { editor, session, windowTarget, id } = await editorHarness({ existing: true })
    const setItem = session.setItem.bind(session)
    session.setItem = () => { throw new Error('Temporarily unavailable') }
    editor.setTitle('Не потерять при закрытии')
    await vi.runOnlyPendingTimersAsync()
    expect(editor.error).toBeTruthy()
    session.setItem = setItem
    windowTarget.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(session.getItem(draftKey(id))!).note.title).toBe('Не потерять при закрытии')
  })
  it('does not recreate a discarded draft from a pending debounce', async () => {
    vi.useFakeTimers()
    const { editor, session, id } = await editorHarness({ existing: true })
    editor.setTitle('Будет отменено')
    const cancel = editor.cancel()
    editor.choose('confirm')
    await cancel
    await vi.runOnlyPendingTimersAsync()
    expect(session.getItem(draftKey(id))).toBeNull()
  })
  it('keeps a pending draft when confirmed discard cannot remove storage', async () => {
    const { editor, session, windowTarget, router, id } = await editorHarness({ existing: true })
    editor.setTitle('Сохранить после ошибки отмены')
    session.removeItem = () => { throw new Error('Storage denied') }
    const cancel = editor.cancel()
    editor.choose('confirm')
    await cancel
    expect(router.currentRoute.value.path).toBe('/notes/saved')
    expect(editor.dirty).toBe(true)
    windowTarget.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(session.getItem(draftKey(id))!).note.title).toBe('Сохранить после ошибки отмены')
  })
  it('does not duplicate a new note when draft cleanup fails after a successful save', async () => {
    const { editor, session, local, router } = await editorHarness()
    editor.setTitle('Сохранить один раз')
    session.removeItem = () => { throw new Error('Storage denied') }
    await editor.save()
    expect(editor.savedWithDraftError).toBe(true)
    expect(router.currentRoute.value.path).toBe('/notes/new')
    await editor.save()
    expect(JSON.parse(local.getItem(NOTES_KEY)!).notes).toHaveLength(1)
  })
  it('offers Save as new when a fresh save discovers a deletion before its storage event', async () => {
    const { editor, local } = await editorHarness({ existing: true })
    local.setItem(NOTES_KEY, JSON.stringify({ version: 1, notes: [] }))
    editor.setTitle('Осталось у меня')
    await editor.save()
    expect(editor.deletedElsewhere).toBe(true)
    expect(editor.note.title).toBe('Осталось у меня')
    expect(JSON.parse(local.getItem(NOTES_KEY)!).notes).toEqual([])
  })
})
