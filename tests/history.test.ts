import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useNoteHistory } from '../app/composables/useNoteHistory'
import type { Note, Todo } from '../app/types/note'

const todo = (id: string, text = id, completed = false): Todo => ({ id, text, completed })

function setup(todos: Todo[] = [todo('a'), todo('b', 'second', true), todo('c')]) {
  const scope = effectScope()
  const note = ref<Note>({ id: 'note', title: 'Original', todos })
  const history = scope.run(() => useNoteHistory(note))!
  scopes.push(scope)
  return { note, history, scope }
}

const scopes: ReturnType<typeof effectScope>[] = []

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

describe('note command history', () => {
  it('separates typing groups at blur without duplicate timer entries', () => {
    const { note, history } = setup()
    history.setTitle('O')
    vi.advanceTimersByTime(300)
    history.setTitle('Changed')
    history.flushText()
    history.setTitle('After blur')
    history.undo()
    expect(note.value.title).toBe('Changed')
    vi.advanceTimersByTime(1000)
    history.undo()
    expect(note.value.title).toBe('Original')
    expect(history.canUndo.value).toBe(false)
    history.redo()
    expect(note.value.title).toBe('Changed')
    history.redo()
    expect(note.value.title).toBe('After blur')
    expect(history.canRedo.value).toBe(false)
  })

  it('starts another command after a 500ms pause or changing the text field', () => {
    const { note, history } = setup()
    history.setTitle('First')
    vi.advanceTimersByTime(499)
    history.setTitle('Second')
    vi.advanceTimersByTime(500)
    history.setTitle('Third')
    history.setTodoText('a', 'edited')
    history.undo()
    expect(note.value.todos[0]!.text).toBe('a')
    expect(note.value.title).toBe('Third')
    history.undo()
    expect(note.value.title).toBe('Second')
    history.undo()
    expect(note.value.title).toBe('Original')
    expect(history.canUndo.value).toBe(false)
  })

  it('discards text that returns to its starting value', () => {
    const { history } = setup()
    history.setTitle('Temporary')
    expect(history.canUndo.value).toBe(true)
    history.setTitle('Original')
    history.flushText()
    history.setTodoText('a', 'a')
    history.setTodoCompleted('a', false)
    history.removeTodo('missing')
    history.setTodoText('missing', 'ignored')
    history.setTodoCompleted('missing', true)
    expect(history.canUndo.value).toBe(false)
  })

  it('suspends text grouping during IME and resumes its timer after composition', () => {
    const { note, history } = setup()
    history.setTitle('Before composition')
    vi.advanceTimersByTime(400)
    history.onCompositionStart()
    history.setTitle('中')
    vi.advanceTimersByTime(2000)
    history.setTitle('中文')
    history.onCompositionEnd()
    vi.advanceTimersByTime(500)
    history.setTitle('Finished')
    history.undo()
    expect(note.value.title).toBe('中文')
    history.undo()
    expect(note.value.title).toBe('Original')
    expect(history.canUndo.value).toBe(false)
  })

  it('undoes a pending text command immediately and keeps redo available', () => {
    const { note, history } = setup()
    history.setTodoText('a', 'pending')
    expect(history.canUndo.value).toBe(true)
    history.undo()
    expect(note.value.todos[0]!.text).toBe('a')
    expect(history.canRedo.value).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(history.canUndo.value).toBe(false)
    history.redo()
    expect(note.value.todos[0]!.text).toBe('pending')
  })

  it('replays mixed text, toggle, add and remove commands in order', () => {
    const { note, history } = setup()
    history.setTitle('Updated')
    history.setTodoCompleted('a', true)
    history.addTodo(todo('d', 'new'))
    history.setTodoText('b', 'updated second')
    history.removeTodo('b')
    history.undo()
    expect(note.value.todos[1]).toEqual(todo('b', 'updated second', true))
    history.undo()
    expect(note.value.todos[1]).toEqual(todo('b', 'second', true))
    history.undo()
    expect(note.value.todos.map(item => item.id)).toEqual(['a', 'b', 'c'])
    history.undo()
    expect(note.value.todos[0]!.completed).toBe(false)
    history.undo()
    expect(note.value.title).toBe('Original')
    expect(history.canUndo.value).toBe(false)
    for (let index = 0; index < 5; index++) history.redo()
    expect(note.value).toEqual({
      id: 'note', title: 'Updated',
      todos: [todo('a', 'a', true), todo('c'), todo('d', 'new')],
    })
  })

  it('isolates an added todo from caller mutations and each restored payload', () => {
    const { note, history } = setup([])
    const source = todo('stable', 'original', true)
    history.addTodo(source)
    source.text = 'caller mutation'
    expect(note.value.todos[0]).toEqual(todo('stable', 'original', true))
    note.value.todos[0]!.text = 'draft mutation'
    history.undo()
    history.redo()
    expect(note.value.todos[0]).toEqual(todo('stable', 'original', true))
    note.value.todos[0]!.completed = false
    history.undo()
    history.redo()
    expect(note.value.todos[0]).toEqual(todo('stable', 'original', true))
  })

  it('restores a removed todo at its original index with isolated identity and completion', () => {
    const { note, history } = setup()
    const removed = note.value.todos[1]!
    history.removeTodo('b')
    removed.text = 'external mutation'
    removed.completed = false
    history.undo()
    expect(note.value.todos).toEqual([todo('a'), todo('b', 'second', true), todo('c')])
    note.value.todos[1]!.text = 'restored mutation'
    history.redo()
    history.undo()
    expect(note.value.todos[1]).toEqual(todo('b', 'second', true))
  })

  it('clears redo on the first actual text change before the timer fires', () => {
    const { note, history } = setup()
    history.setTodoCompleted('a', true)
    history.undo()
    history.setTitle('Original')
    expect(history.canRedo.value).toBe(true)
    history.setTitle('new branch')
    expect(history.canRedo.value).toBe(false)
    history.redo()
    expect(note.value.todos[0]!.completed).toBe(false)
    expect(note.value.title).toBe('new branch')
  })

  it('retains at most 50 reversible commands including redo commands', () => {
    const { note, history } = setup()
    for (let index = 0; index < 51; index++) history.setTodoCompleted('a', index % 2 === 0)
    for (let index = 0; index < 50; index++) {
      expect(history.canUndo.value).toBe(true)
      history.undo()
    }
    expect(note.value.todos[0]!.completed).toBe(true)
    expect(history.canUndo.value).toBe(false)
    for (let index = 0; index < 50; index++) {
      expect(history.canRedo.value).toBe(true)
      history.redo()
    }
    expect(note.value.todos[0]!.completed).toBe(true)
    expect(history.canRedo.value).toBe(false)
  })

  it('reset cancels pending text and timers without modifying the draft', () => {
    const { note, history } = setup()
    history.setTodoCompleted('a', true)
    history.setTitle('pending')
    history.reset()
    vi.advanceTimersByTime(1000)
    expect(note.value.title).toBe('pending')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    history.undo()
    expect(note.value.title).toBe('pending')
  })

  it('scope disposal cancels the pending timer', () => {
    const { history, scope } = setup()
    history.setTitle('pending')
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
