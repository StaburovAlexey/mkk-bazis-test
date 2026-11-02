import { ref } from 'vue'
import { isNoteData } from './useNotesState'
import type { DraftData, Note } from '../types/note'

export const draftKey = (id: string) => `mkk-basis:draft:${id}`

export function useNoteDraft(noteId: string, storage?: Storage) {
  const error = ref<string | null>(null)
  const key = draftKey(noteId)

  function getStorage(): Storage {
    const target = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined)
    if (!target) throw new Error('Storage unavailable')
    return target
  }

  function load(): Note | null {
    let raw: string | null
    try {
      raw = getStorage().getItem(key)
    } catch {
      error.value = 'Не удалось прочитать черновик. Хранилище браузера недоступно.'
      return null
    }
    if (raw === null) {
      error.value = null
      return null
    }
    try {
      const data: unknown = JSON.parse(raw)
      if (typeof data !== 'object' || data === null || !('version' in data)
        || data.version !== 1 || !('note' in data) || !isNoteData(data.note)) throw new Error('Invalid draft')
      error.value = null
      return data.note
    } catch {
      error.value = 'Черновик повреждён или имеет неподдерживаемый формат. Данные не изменены.'
      return null
    }
  }

  function write(note: Note): boolean {
    if (!isNoteData(note)) {
      error.value = 'Некорректные данные черновика.'
      return false
    }
    load()
    if (error.value) return false
    const data: DraftData = { version: 1, note }
    try {
      getStorage().setItem(key, JSON.stringify(data))
      error.value = null
      return true
    } catch {
      error.value = 'Не удалось сохранить черновик. Возможно, хранилище недоступно или заполнено.'
      return false
    }
  }

  function clear(): boolean {
    try {
      getStorage().removeItem(key)
      error.value = null
      return true
    } catch {
      error.value = 'Не удалось удалить черновик. Хранилище браузера недоступно.'
      return false
    }
  }

  return { error, load, write, clear }
}
