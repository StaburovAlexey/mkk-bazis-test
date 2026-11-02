import { computed, onScopeDispose, ref, type Ref } from 'vue'
import type { Note, Todo } from '../types/note'

type TextField = { kind: 'title' } | { kind: 'todo-text'; id: string }
type TextCommand = TextField & { before: string; after: string }
type Command = TextCommand
  | { kind: 'completed'; id: string; before: boolean; after: boolean }
  | { kind: 'add' | 'remove'; todo: Todo; index: number }

export function useNoteHistory(note: Ref<Note>) {
  const commands = ref<Command[]>([])
  const cursor = ref(0)
  const pending = ref<TextCommand | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let composing = false

  const hasPendingChange = computed(() => pending.value !== null && pending.value.before !== pending.value.after)

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function clearRedo() {
    commands.value.splice(cursor.value)
  }

  function record(command: Command) {
    clearRedo()
    commands.value.push(command)
    if (commands.value.length > 50) commands.value.shift()
    cursor.value = commands.value.length
  }

  function flushText() {
    cancelTimer()
    const command = pending.value
    pending.value = null
    if (command && command.before !== command.after) record({ ...command })
  }

  function scheduleText() {
    cancelTimer()
    if (!composing && pending.value) timer = setTimeout(flushText, 500)
  }

  function readText(field: TextField) {
    return field.kind === 'title'
      ? note.value.title
      : note.value.todos.find(todo => todo.id === field.id)?.text
  }

  function writeText(field: TextField, value: string) {
    if (field.kind === 'title') note.value.title = value
    else {
      const todo = note.value.todos.find(todo => todo.id === field.id)
      if (todo) todo.text = value
    }
  }

  function setText(field: TextField, value: string) {
    const before = readText(field)
    if (before === undefined || before === value) return
    const previous = pending.value
    if (previous && (previous.kind !== field.kind
      || (previous.kind === 'todo-text' && field.kind === 'todo-text' && previous.id !== field.id))) {
      flushText()
    }
    clearRedo()
    if (!pending.value) pending.value = { ...field, before, after: value }
    else pending.value.after = value
    writeText(field, value)
    scheduleText()
  }

  function setTitle(value: string) {
    setText({ kind: 'title' }, value)
  }

  function setTodoText(id: string, value: string) {
    setText({ kind: 'todo-text', id }, value)
  }

  function setTodoCompleted(id: string, completed: boolean) {
    flushText()
    const todo = note.value.todos.find(todo => todo.id === id)
    if (!todo || todo.completed === completed) return
    record({ kind: 'completed', id, before: todo.completed, after: completed })
    todo.completed = completed
  }

  function addTodo(todo: Todo) {
    flushText()
    record({ kind: 'add', todo: { ...todo }, index: note.value.todos.length })
    note.value.todos.push({ ...todo })
  }

  function removeTodo(id: string) {
    flushText()
    const index = note.value.todos.findIndex(todo => todo.id === id)
    const todo = note.value.todos[index]
    if (!todo) return
    record({ kind: 'remove', todo: { ...todo }, index })
    note.value.todos.splice(index, 1)
  }

  function apply(command: Command, forward: boolean) {
    if (command.kind === 'title' || command.kind === 'todo-text') {
      writeText(command, forward ? command.after : command.before)
    } else if (command.kind === 'completed') {
      const todo = note.value.todos.find(todo => todo.id === command.id)
      if (todo) todo.completed = forward ? command.after : command.before
    } else if ((command.kind === 'add') === forward) {
      note.value.todos.splice(command.index, 0, { ...command.todo })
    } else {
      const index = note.value.todos.findIndex(todo => todo.id === command.todo.id)
      if (index !== -1) note.value.todos.splice(index, 1)
    }
  }

  function undo() {
    flushText()
    const command = commands.value[cursor.value - 1]
    if (!command) return
    apply(command, false)
    cursor.value--
  }

  function redo() {
    flushText()
    const command = commands.value[cursor.value]
    if (!command) return
    apply(command, true)
    cursor.value++
  }

  function reset() {
    cancelTimer()
    pending.value = null
    commands.value = []
    cursor.value = 0
    composing = false
  }

  function onCompositionStart() {
    composing = true
    cancelTimer()
  }

  function onCompositionEnd() {
    composing = false
    scheduleText()
  }

  onScopeDispose(cancelTimer)

  return {
    setTitle,
    setTodoText,
    setTodoCompleted,
    addTodo,
    removeTodo,
    flushText,
    undo,
    redo,
    reset,
    onCompositionStart,
    onCompositionEnd,
    canUndo: computed(() => cursor.value > 0 || hasPendingChange.value),
    canRedo: computed(() => cursor.value < commands.value.length),
    undoCount: computed(() => cursor.value),
    redoCount: computed(() => commands.value.length - cursor.value),
  }
}
