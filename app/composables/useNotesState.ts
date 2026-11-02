import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { Note, SaveResult, Todo } from '../types/note'

export const NOTES_KEY = 'mkk-basis:notes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNoteData(value: unknown): value is Note {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.title !== 'string' || !Array.isArray(value.todos)) return false
  const ids = new Set<string>()
  return value.todos.every((todo: unknown): todo is Todo => {
    if (!isRecord(todo) || typeof todo.id !== 'string' || !todo.id.trim()
      || typeof todo.text !== 'string' || typeof todo.completed !== 'boolean'
      || ids.has(todo.id)) return false
    ids.add(todo.id)
    return true
  })
}

export function useNotesState(storage?: Storage, events?: Window) {
  const notes = ref<Note[]>([])
  const error = ref<string | null>(null)
  const ready = ref(false)
  let initialized = false
  let eventTarget: Window | undefined

  function getStorage(): Storage {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    if (!target) throw new Error('Storage unavailable')
    return target
  }

  function read(): { ok: true; notes: Note[] } | { ok: false; reason: 'storage' | 'invalid-data' } {
    let raw: string | null
    try {
      raw = getStorage().getItem(NOTES_KEY)
    } catch {
      error.value = 'Не удалось прочитать заметки. Проверьте доступ к хранилищу браузера.'
      return { ok: false, reason: 'storage' }
    }
    if (raw === null) return { ok: true, notes: [] }
    try {
      const data: unknown = JSON.parse(raw)
      if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.notes)
        || !data.notes.every(isNoteData)
        || new Set(data.notes.map(note => note.id)).size !== data.notes.length) throw new Error('Invalid data')
      return { ok: true, notes: data.notes }
    } catch {
      error.value = 'Сохранённые заметки повреждены или имеют неподдерживаемый формат. Данные не изменены.'
      return { ok: false, reason: 'invalid-data' }
    }
  }

  function refresh(): boolean {
    const result = read()
    if (!result.ok) return false
    notes.value = result.notes
    error.value = null
    return true
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== NOTES_KEY) return
    if (event.storageArea) {
      try {
        if (event.storageArea !== getStorage()) return
      } catch {
        refresh()
        return
      }
    }
    refresh()
  }

  function initialize() {
    if (initialized) return
    initialized = true
    eventTarget = events ?? (typeof window !== 'undefined' ? window : undefined)
    eventTarget?.addEventListener('storage', onStorage)
    refresh()
    ready.value = true
  }

  if (getCurrentScope()) {
    onScopeDispose(() => eventTarget?.removeEventListener('storage', onStorage))
  }

  function write(nextNotes: Note[]): boolean {
    try {
      getStorage().setItem(NOTES_KEY, JSON.stringify({ version: 1, notes: nextNotes }))
    } catch {
      error.value = 'Не удалось сохранить заметки. Возможно, хранилище недоступно или заполнено.'
      return false
    }
    notes.value = nextNotes
    error.value = null
    return true
  }

  function save(note: Note, isNew = false): SaveResult {
    if (!isNoteData(note)) {
      error.value = 'Некорректные данные заметки.'
      return { ok: false, reason: 'invalid-data' }
    }
    if (note.todos.some(todo => !todo.text.trim())) {
      error.value = 'Заполните текст каждой задачи или удалите пустые задачи.'
      return { ok: false, reason: 'validation' }
    }
    const latest = read()
    if (!latest.ok) return latest
    const index = latest.notes.findIndex(item => item.id === note.id)
    if (!isNew && index === -1) {
      error.value = 'Эта заметка была удалена. Сохранение отменено.'
      return { ok: false, reason: 'deleted' }
    }
    if (isNew && index !== -1) {
      error.value = 'Заметка с таким идентификатором уже существует.'
      return { ok: false, reason: 'invalid-data' }
    }
    const normalized: Note = {
      id: note.id,
      title: note.title.trim() || 'Без названия',
      todos: note.todos.map(todo => ({ id: todo.id, text: todo.text.trim(), completed: todo.completed })),
    }
    if (isNew) latest.notes.push(normalized)
    else latest.notes[index] = normalized
    if (!write(latest.notes)) return { ok: false, reason: 'storage' }
    return { ok: true, note: normalized }
  }

  function remove(id: string): boolean {
    const latest = read()
    if (!latest.ok) return false
    if (!latest.notes.some(note => note.id === id)) {
      error.value = 'Эта заметка уже удалена.'
      return false
    }
    return write(latest.notes.filter(note => note.id !== id))
  }

  function setTodoCompleted(noteId: string, todoId: string, completed: boolean): boolean {
    const latest = read()
    if (!latest.ok) return false
    const todo = latest.notes.find(note => note.id === noteId)?.todos.find(todo => todo.id === todoId)
    if (!todo) {
      error.value = 'Заметка или задача уже удалена. Обновите список.'
      return false
    }
    todo.completed = completed
    return write(latest.notes)
  }

  return { notes, error, ready, initialize, refresh, save, remove, setTodoCompleted }
}
