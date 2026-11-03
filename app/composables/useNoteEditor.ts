import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { Note, Todo } from '~/types/note'
import { useNotesStore } from '~/stores/notes'
import { useNoteDraft } from './useNoteDraft'
import { useNoteHistory } from './useNoteHistory'
import { useConfirmation } from './useConfirmDialog'

export function historyShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'>, blocked = false): 'undo' | 'redo' | null {
  if (blocked || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return null
  if (event.code !== 'KeyZ' && event.key.toLowerCase() !== 'z') return null
  return event.shiftKey ? 'redo' : 'undo'
}

function copyNote(note: Note): Note {
  return { id: note.id, title: note.title, todos: note.todos.map(todo => ({ ...todo })) }
}

export function useNoteEditor() {
  const route = useRoute()
  const router = useRouter()
  const store = useNotesStore()
  const routeId = String(route.params.id)
  const draft = useNoteDraft(routeId)
  const confirmation = useConfirmation()
  const note = ref<Note>({ id: crypto.randomUUID(), title: '', todos: [] })
  const original = ref(copyNote(note.value))
  const history = useNoteHistory(note)
  const ready = ref(false)
  const missing = ref(false)
  const isNew = ref(routeId === 'new')
  const attemptedSave = ref(false)
  const actionError = ref('')
  const composing = ref(false)
  const draftBlocked = ref(false)
  const deletionDetected = ref(false)
  const savedWithDraftError = ref(false)
  let persistenceAllowed = false
  let leaving = false
  let pendingDraft = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const dirty = computed(() => JSON.stringify(note.value) !== JSON.stringify(original.value))
  const deletedElsewhere = computed(() => ready.value && !isNew.value && (deletionDetected.value || !store.notes.some(item => item.id === routeId)))
  const todoErrors = computed(() => Object.fromEntries(note.value.todos
    .filter(todo => attemptedSave.value && !todo.text.trim())
    .map(todo => [todo.id, 'Введите текст задачи или удалите её.'])))
  const error = computed(() => actionError.value || store.error || draft.error.value || '')
  const editorTitle = computed(() => isNew.value ? 'Новая заметка' : 'Редактирование заметки')

  function stopDraftTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  function flushDraft() {
    stopDraftTimer()
    if (!pendingDraft || !persistenceAllowed || draftBlocked.value || leaving || missing.value) return
    pendingDraft = !draft.write(copyNote(note.value))
  }
  watch(note, () => {
    if (!persistenceAllowed || leaving || draftBlocked.value || missing.value) return
    pendingDraft = true
    stopDraftTimer()
    timer = setTimeout(flushDraft, 500)
  }, { deep: true, flush: 'sync' })

  function setTitle(value: string) { history.setTitle(value) }
  function setTodoText(id: string, value: string) { history.setTodoText(id, value) }
  function setTodoCompleted(id: string, value: boolean) { history.setTodoCompleted(id, value) }
  function removeTodo(id: string) { history.removeTodo(id) }
  async function addTodo() {
    const id = crypto.randomUUID()
    history.addTodo({ id, text: '', completed: false })
    await nextTick()
    document.getElementById(`todo-${id}`)?.focus()
  }
  function compositionStart() { composing.value = true; history.onCompositionStart() }
  function compositionEnd() { composing.value = false; history.onCompositionEnd() }
  function undo() { history.undo() }
  function redo() { history.redo() }
  function onKeydown(event: KeyboardEvent) {
    const intent = historyShortcut(event, !!confirmation.dialog.value || composing.value || !ready.value || missing.value)
    if (!intent) return
    event.preventDefault()
    if (intent === 'undo') undo()
    else redo()
  }
  function onBeforeInput(event: InputEvent) {
    if (!ready.value || missing.value || composing.value || confirmation.dialog.value || event.isComposing) return
    if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return
    event.preventDefault()
    if (event.inputType === 'historyUndo') undo()
    else redo()
  }
  function onVisibilityChange() { if (document.visibilityState === 'hidden') flushDraft() }

  async function goToList() {
    leaving = true
    await router.push('/')
  }
  function discardDraft(): boolean {
    if (!draft.clear()) return false
    stopDraftTimer()
    pendingDraft = false
    persistenceAllowed = false
    history.reset()
    return true
  }
  async function cancel() {
    const choice = await confirmation.ask({ title: 'Отменить редактирование?', message: 'Изменения и черновик этой заметки будут удалены.', confirmLabel: 'Отменить изменения', cancelLabel: 'Продолжить редактирование', danger: true })
    if (choice === 'confirm' && discardDraft()) await goToList()
  }
  async function deleteNote() {
    const choice = await confirmation.ask({ title: 'Удалить заметку?', message: 'Заметка и её черновик будут удалены. Это действие нельзя отменить.', confirmLabel: 'Удалить', cancelLabel: 'Отмена', danger: true })
    if (choice !== 'confirm') return
    if (!store.remove(routeId)) return
    if (!discardDraft()) return
    await goToList()
  }
  async function save(asNew = false) {
    if (savedWithDraftError.value) return
    history.flushText()
    attemptedSave.value = true
    actionError.value = ''
    if (note.value.todos.some(todo => !todo.text.trim())) {
      await nextTick()
      document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const creating = isNew.value || asNew
    const savedNote = copyNote(note.value)
    savedNote.title = savedNote.title.trim() || 'Без названия'
    if (creating) savedNote.id = crypto.randomUUID()
    const result = store.save(savedNote, creating)
    if (!result.ok) {
      if (result.reason === 'deleted') {
        deletionDetected.value = true
        actionError.value = 'Заметка удалена в другой вкладке. Сохраните изменения как новую заметку.'
      }
      else if (!store.error) actionError.value = 'Не удалось сохранить заметку. Попробуйте ещё раз.'
      return
    }
    stopDraftTimer()
    pendingDraft = false
    persistenceAllowed = false
    original.value = copyNote(note.value)
    history.reset()
    if (!draft.clear()) {
      savedWithDraftError.value = true
      actionError.value = 'Заметка сохранена, но удалить черновик не удалось. Повторите очистку перед выходом.'
      return
    }
    await goToList()
  }
  async function retryDraftClear() {
    if (draft.clear()) await goToList()
  }

  onBeforeRouteLeave(async () => {
    if (leaving || !ready.value || !dirty.value) return true
    const choice = await confirmation.ask({ title: 'Покинуть редактор?', message: 'Несохранённые изменения и черновик будут удалены.', confirmLabel: 'Выйти без сохранения', cancelLabel: 'Остаться', danger: true })
    return choice === 'confirm' && discardDraft()
  })

  onMounted(async () => {
    store.initialize()
    const saved = store.notes.find(item => item.id === routeId)
    if (saved) note.value = copyNote(saved)
    else if (!isNew.value) missing.value = true
    original.value = copyNote(note.value)
    history.reset()
    const recovered = draft.load()
    draftBlocked.value = !!draft.error.value
    if (recovered) {
      const choice = await confirmation.ask({ title: 'Найден черновик', message: missing.value ? 'Исходная заметка не найдена. Черновик можно восстановить и сохранить как новую заметку.' : 'В этой вкладке остались несохранённые изменения. Восстановить их?', confirmLabel: 'Восстановить', alternativeLabel: 'Удалить черновик', cancelLabel: 'Вернуться к списку' })
      if (choice === 'cancel') { await goToList(); return }
      if (choice === 'confirm') {
        note.value = copyNote(recovered)
        if (missing.value) { isNew.value = true; missing.value = false }
        history.reset()
      } else if (!draft.clear()) {
        draftBlocked.value = true
      }
    }
    ready.value = true
    persistenceAllowed = !draftBlocked.value && !missing.value
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('beforeinput', onBeforeInput)
    window.addEventListener('pagehide', flushDraft)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    flushDraft()
    stopDraftTimer()
    history.reset()
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('beforeinput', onBeforeInput)
    window.removeEventListener('pagehide', flushDraft)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return reactive({ note, ready, missing, isNew, dirty, deletedElsewhere, todoErrors, error, editorTitle,
    canUndo: history.canUndo, canRedo: history.canRedo, dialog: confirmation.dialog, choose: confirmation.choose,
    savedWithDraftError, retryDraftClear, setTitle, setTodoText, setTodoCompleted, removeTodo, addTodo,
    compositionStart, compositionEnd, flushText: history.flushText, undo, redo, cancel, deleteNote, save: () => save(), saveAsNew: () => save(true),
  })
}

type FormEmit = {
  (event: 'title', value: string): void
  (event: 'submit'): void
}
export function useNoteFormEvents(emit: FormEmit) {
  return {
    titleInput: (event: Event) => emit('title', (event.target as HTMLInputElement).value),
    submit: (event: Event) => { event.preventDefault(); emit('submit') },
  }
}

type TodoEmit = {
  (event: 'text', id: string, value: string): void
  (event: 'completed', id: string, value: boolean): void
  (event: 'remove', id: string): void
}
export function useTodoItemEvents(todo: () => Todo, emit: TodoEmit) {
  return {
    input: (event: Event) => emit('text', todo().id, (event.target as HTMLInputElement).value),
    toggle: (event: Event) => emit('completed', todo().id, (event.target as HTMLInputElement).checked),
    remove: () => emit('remove', todo().id),
  }
}
