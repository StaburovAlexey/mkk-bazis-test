export interface Todo {
  id: string
  text: string
  completed: boolean
}

export interface Note {
  id: string
  title: string
  todos: Todo[]
}

export interface DraftData {
  version: 1
  note: Note
}

export type SaveResult =
  | { ok: true; note: Note }
  | { ok: false; reason: 'deleted' | 'storage' | 'invalid-data' | 'validation' }
