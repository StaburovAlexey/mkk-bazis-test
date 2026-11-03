import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNotePreview } from '../app/composables/useNotesList'
import type { Note } from '../app/types/note'

const makeNote = (): Note => ({
  id: 'note', title: 'Заметка',
  todos: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, text: id, completed: false })),
})

describe('note task preview', () => {
  it('expands all tasks and collapses back to the first three', () => {
    const preview = useNotePreview(makeNote, () => {})
    expect(preview.preview.value.map(todo => todo.id)).toEqual(['a', 'b', 'c'])
    expect(preview.remaining.value).toBe(2)
    expect(preview.expanded.value).toBe(false)
    preview.toggleExpanded()
    expect(preview.preview.value.map(todo => todo.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(preview.expanded.value).toBe(true)
    preview.toggleExpanded()
    expect(preview.preview.value.map(todo => todo.id)).toEqual(['a', 'b', 'c'])
    expect(preview.expanded.value).toBe(false)
  })

  it('keeps expansion local to each card and reacts to updated saved tasks', () => {
    const note = ref(makeNote())
    const first = useNotePreview(() => note.value, () => {})
    const second = useNotePreview(makeNote, () => {})
    first.toggleExpanded()
    note.value = { ...makeNote(), todos: [...makeNote().todos, { id: 'f', text: 'f', completed: true }] }
    expect(first.preview.value.map(todo => todo.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(second.preview.value).toHaveLength(3)
    note.value.todos = note.value.todos.slice(0, 3)
    expect(first.remaining.value).toBe(0)
    expect(first.preview.value).toHaveLength(3)
  })
})
