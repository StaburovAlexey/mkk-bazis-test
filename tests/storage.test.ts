import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { NOTES_KEY, useNotesState } from '../app/composables/useNotesState'
import { draftKey, useNoteDraft } from '../app/composables/useNoteDraft'
import { useNotesStore } from '../app/stores/notes'
import { useNotePreview } from '../app/composables/useNotesList'
import type { Note } from '../app/types/note'

class MemoryStorage implements Storage {
  data = new Map<string, string>()
  writes = 0
  failRead = false
  failWrite = false
  failRemove = false
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  clear() { this.data.clear() }
  getItem(key: string) {
    if (this.failRead) throw new Error('Storage blocked')
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Quota exceeded')
    this.writes++
    this.data.set(key, value)
  }
  removeItem(key: string) {
    if (this.failRemove) throw new Error('Storage blocked')
    this.data.delete(key)
  }
}

function note(id = 'one'): Note {
  return { id, title: 'Заметка', todos: [{ id: `${id}-task`, text: 'Задача', completed: false }] }
}
function seed(storage: MemoryStorage, notes: Note[]) {
  storage.data.set(NOTES_KEY, JSON.stringify({ version: 1, notes }))
}
function saved(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(NOTES_KEY)!).notes as Note[]
}
function storageEvent(events: EventTarget, key: string | null = NOTES_KEY, storageArea?: Storage) {
  const event = new Event('storage')
  Object.assign(event, { key, storageArea })
  events.dispatchEvent(event)
}

afterEach(() => vi.unstubAllGlobals())

describe('saved notes', () => {
  it('initializes an empty store without writing, even after direct state edits', async () => {
    const storage = new MemoryStorage()
    const state = useNotesState(storage)
    expect(state.ready.value).toBe(false)
    state.initialize()
    state.initialize()
    expect(state.ready.value).toBe(true)
    expect(state.notes.value).toEqual([])
    state.notes.value.push(note())
    await nextTick()
    expect(storage.writes).toBe(0)
    expect(storage.getItem(NOTES_KEY)).toBeNull()
  })

  it('creates, normalizes, updates, reloads and deletes notes only on explicit actions', () => {
    const storage = new MemoryStorage()
    const state = useNotesState(storage)
    state.initialize()
    const input = { ...note(), title: '  ', todos: [{ id: 'task', text: '  Купить молоко  ', completed: true }] }
    const result = state.save(input, true)
    expect(result).toEqual({ ok: true, note: { id: 'one', title: 'Без названия', todos: [{ id: 'task', text: 'Купить молоко', completed: true }] } })
    expect(input.title).toBe('  ')
    input.todos[0]!.text = 'Изменено в редакторе'
    expect(state.notes.value[0]!.todos[0]!.text).toBe('Купить молоко')
    expect(state.save({ ...note(), title: '  Новый заголовок  ' })).toMatchObject({ ok: true })
    const reloaded = useNotesState(storage)
    reloaded.initialize()
    expect(reloaded.notes.value[0]!.title).toBe('Новый заголовок')
    expect(reloaded.remove('one')).toBe(true)
    expect(saved(storage)).toEqual([])
    expect(state.notes.value).toHaveLength(1)
  })

  it('rejects empty task text without changing saved data', () => {
    const storage = new MemoryStorage()
    const state = useNotesState(storage)
    expect(state.save({ ...note(), todos: [{ id: 'task', text: ' \n ', completed: false }] }, true)).toEqual({ ok: false, reason: 'validation' })
    expect(storage.writes).toBe(0)
    expect(state.error.value).toBeTruthy()
  })

  it('does not resurrect a missing note or overwrite a duplicate new ID', () => {
    const storage = new MemoryStorage()
    const state = useNotesState(storage)
    expect(state.save(note())).toEqual({ ok: false, reason: 'deleted' })
    seed(storage, [note()])
    expect(state.save(note(), true)).toEqual({ ok: false, reason: 'invalid-data' })
    expect(state.remove('missing')).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('merges latest storage before saving and removing', () => {
    const storage = new MemoryStorage()
    seed(storage, [note()])
    const state = useNotesState(storage)
    state.initialize()
    seed(storage, [note(), note('external')])
    expect(state.save({ ...note(), title: 'Отредактировано' }).ok).toBe(true)
    expect(saved(storage).map(item => item.id)).toEqual(['one', 'external'])
    seed(storage, [...saved(storage), note('third')])
    expect(state.remove('one')).toBe(true)
    expect(state.notes.value.map(item => item.id)).toEqual(['external', 'third'])
    seed(storage, [note('third')])
    expect(state.save(note('external'))).toEqual({ ok: false, reason: 'deleted' })
    expect(saved(storage).map(item => item.id)).toEqual(['third'])
  })

  it('persists a list checkbox without overwriting newer note fields or other notes', () => {
    const storage = new MemoryStorage()
    seed(storage, [note()])
    const state = useNotesState(storage)
    state.initialize()
    const latest = { ...note(), title: 'Обновлено в другой вкладке' }
    latest.todos[0]!.text = 'Обновлённая задача'
    seed(storage, [latest, note('external')])
    expect(state.setTodoCompleted('one', 'one-task', true)).toBe(true)
    expect(saved(storage)).toEqual([
      { ...latest, todos: [{ id: 'one-task', text: 'Обновлённая задача', completed: true }] },
      note('external'),
    ])
    const reloaded = useNotesState(storage)
    reloaded.initialize()
    expect(reloaded.notes.value[0]!.todos[0]!.completed).toBe(true)
    expect(state.setTodoCompleted('one', 'one-task', false)).toBe(true)
    expect(saved(storage)[0]!.todos[0]!.completed).toBe(false)
  })

  it('does not resurrect deleted notes or tasks from a stale list checkbox', () => {
    const storage = new MemoryStorage()
    seed(storage, [note()])
    const state = useNotesState(storage)
    state.initialize()
    seed(storage, [{ ...note(), todos: [] }])
    expect(state.setTodoCompleted('one', 'one-task', true)).toBe(false)
    expect(saved(storage)[0]!.todos).toEqual([])
    seed(storage, [])
    expect(state.setTodoCompleted('one', 'one-task', true)).toBe(false)
    expect(saved(storage)).toEqual([])
    expect(storage.writes).toBe(0)
  })

  it('keeps checkbox state and saved data unchanged if a list action cannot persist', () => {
    const storage = new MemoryStorage()
    seed(storage, [note()])
    const state = useNotesState(storage)
    state.initialize()
    const preview = useNotePreview(() => state.notes.value[0]!, (_event, id, todoId, completed) => {
      state.setTodoCompleted(id, todoId, completed)
    })
    storage.failWrite = true
    const checkbox = { checked: true }
    preview.toggleTodo('one-task', { target: checkbox } as unknown as Event)
    expect(checkbox.checked).toBe(false)
    expect(state.notes.value[0]!.todos[0]!.completed).toBe(false)
    expect(saved(storage)[0]!.todos[0]!.completed).toBe(false)
    expect(state.error.value).toBeTruthy()
  })

  it('refreshes on storage changes without writing and removes its listener with its scope', () => {
    const storage = new MemoryStorage()
    const events = new EventTarget()
    const scope = effectScope()
    const state = scope.run(() => useNotesState(storage, events as Window))!
    state.initialize()
    state.initialize()
    seed(storage, [note()])
    storageEvent(events, 'other')
    expect(state.notes.value).toEqual([])
    storageEvent(events, NOTES_KEY, new MemoryStorage())
    expect(state.notes.value).toEqual([])
    storageEvent(events, NOTES_KEY, storage)
    expect(state.notes.value).toEqual([note()])
    storage.data.delete(NOTES_KEY)
    storageEvent(events, null, storage)
    expect(state.notes.value).toEqual([])
    expect(storage.writes).toBe(0)
    scope.stop()
    seed(storage, [note('after-dispose')])
    storageEvent(events)
    expect(state.notes.value).toEqual([])
  })

  it.each([
    '{broken',
    JSON.stringify({ version: 2, notes: [] }),
    JSON.stringify({ notes: [] }),
    JSON.stringify({ version: 1, notes: [{ id: 'one', title: 'Missing todos' }] }),
    JSON.stringify({ version: 1, notes: [{ ...note(), todos: [{ id: 'task', text: 'Missing completed' }] }] }),
    JSON.stringify({ version: 1, notes: [note(), note()] }),
    JSON.stringify({ version: 1, notes: [{ ...note(), todos: [note().todos[0], note().todos[0]] }] }),
  ])('preserves corrupt or unsupported saved content: %s', raw => {
    const storage = new MemoryStorage()
    seed(storage, [note('retained')])
    const state = useNotesState(storage)
    state.initialize()
    storage.data.set(NOTES_KEY, raw)
    expect(state.refresh()).toBe(false)
    expect(state.save(note('new'), true)).toEqual({ ok: false, reason: 'invalid-data' })
    expect(state.remove('retained')).toBe(false)
    expect(state.notes.value).toEqual([note('retained')])
    expect(storage.getItem(NOTES_KEY)).toBe(raw)
    expect(storage.writes).toBe(0)
    expect(state.error.value).toBeTruthy()
  })

  it('preserves state when reading or writing storage throws, then recovers', () => {
    const storage = new MemoryStorage()
    seed(storage, [note()])
    const state = useNotesState(storage)
    state.initialize()
    storage.failRead = true
    expect(state.refresh()).toBe(false)
    expect(state.save(note('new'), true)).toEqual({ ok: false, reason: 'storage' })
    expect(state.remove('one')).toBe(false)
    storage.failRead = false
    storage.failWrite = true
    expect(state.save({ ...note(), title: 'Lost write' })).toEqual({ ok: false, reason: 'storage' })
    expect(state.remove('one')).toBe(false)
    expect(state.notes.value).toEqual([note()])
    expect(saved(storage)).toEqual([note()])
    expect(state.error.value).toBeTruthy()
    storage.failWrite = false
    expect(state.refresh()).toBe(true)
    expect(state.error.value).toBeNull()
  })

  it('handles blocked browser storage getters safely', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('Blocked') } })
    const state = useNotesState()
    expect(state.refresh()).toBe(false)
    expect(state.save(note(), true)).toEqual({ ok: false, reason: 'storage' })
    expect(state.error.value).toBeTruthy()
  })

  it('keeps real Pinia state synchronized after actions', () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage }))
    setActivePinia(createPinia())
    const store = useNotesStore()
    store.initialize()
    expect(store.save(note(), true).ok).toBe(true)
    expect(store.notes).toEqual([note()])
    expect(store.$state.notes).toEqual([note()])
    expect(store.ready).toBe(true)
    store.remove('one')
    expect(store.notes).toEqual([])
    expect(store.$state.notes).toEqual([])
    store.$dispose()
  })
})

describe('session drafts', () => {
  it('loads, writes and clears an isolated draft, allowing incomplete text', () => {
    const storage = new MemoryStorage()
    const draft = useNoteDraft('new', storage)
    expect(draft.load()).toBeNull()
    expect(storage.writes).toBe(0)
    const incomplete = { id: 'draft', title: '', todos: [{ id: 'task', text: '', completed: false }] }
    expect(draft.write(incomplete)).toBe(true)
    expect(JSON.parse(storage.getItem(draftKey('new'))!)).toEqual({ version: 1, note: incomplete })
    incomplete.title = 'Later edit'
    expect(draft.load()!.title).toBe('')
    expect(useNoteDraft('other', storage).load()).toBeNull()
    expect(useNoteDraft('new', storage).load()!.todos[0]!.text).toBe('')
    expect(draft.clear()).toBe(true)
    expect(draft.load()).toBeNull()
  })

  it.each(['{broken', JSON.stringify({ version: 2, note: note() }), JSON.stringify({ version: 1, note: { id: 'one' } })])('preserves an unreadable draft: %s', raw => {
    const storage = new MemoryStorage()
    storage.data.set(draftKey('one'), raw)
    const draft = useNoteDraft('one', storage)
    expect(draft.load()).toBeNull()
    expect(draft.error.value).toBeTruthy()
    expect(draft.write(note())).toBe(false)
    expect(storage.getItem(draftKey('one'))).toBe(raw)
    expect(storage.writes).toBe(0)
    expect(draft.clear()).toBe(true)
    expect(draft.error.value).toBeNull()
  })

  it('preserves a draft when storage operations fail and clears errors after recovery', () => {
    const storage = new MemoryStorage()
    const draft = useNoteDraft('one', storage)
    draft.write(note())
    const before = storage.getItem(draftKey('one'))
    storage.failRead = true
    expect(draft.load()).toBeNull()
    expect(draft.error.value).toBeTruthy()
    expect(draft.write(note('other'))).toBe(false)
    storage.failRead = false
    storage.failWrite = true
    expect(draft.write(note('other'))).toBe(false)
    storage.failRemove = true
    expect(draft.clear()).toBe(false)
    expect(storage.getItem(draftKey('one'))).toBe(before)
    storage.failWrite = false
    storage.failRemove = false
    expect(draft.load()).toEqual(note())
    expect(draft.error.value).toBeNull()
  })

  it('uses sessionStorage by default and handles blocked access', () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('window', { sessionStorage: storage })
    expect(useNoteDraft('one').write(note())).toBe(true)
    expect(useNoteDraft('one').load()).toEqual(note())
    vi.stubGlobal('window', { get sessionStorage() { throw new Error('Blocked') } })
    const blocked = useNoteDraft('one')
    expect(blocked.load()).toBeNull()
    expect(blocked.write(note())).toBe(false)
    expect(blocked.clear()).toBe(false)
    expect(blocked.error.value).toBeTruthy()
  })
})
