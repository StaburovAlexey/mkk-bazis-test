import { computed, onMounted, reactive, ref } from 'vue'
import type { Note } from '~/types/note'
import { useNotesStore } from '~/stores/notes'
import { useConfirmation } from './useConfirmDialog'

export function useNotesList() {
  const store = useNotesStore()
  const confirmation = useConfirmation()
  onMounted(() => store.initialize())
  async function deleteNote(id: string) {
    const note = store.notes.find(note => note.id === id)
    if (!note) return
    const choice = await confirmation.ask({
      title: 'Удалить заметку?',
      message: `Заметка «${note.title || 'Без названия'}» будет удалена. Это действие нельзя отменить.`,
      confirmLabel: 'Удалить', cancelLabel: 'Отмена', danger: true,
    })
    if (choice === 'confirm') store.remove(id)
  }
  return reactive({
    notes: computed(() => store.notes),
    error: computed(() => store.error),
    ready: computed(() => store.ready),
    dialog: confirmation.dialog,
    choose: confirmation.choose,
    deleteNote,
    setTodoCompleted: store.setTodoCompleted,
    retry: () => store.refresh(),
  })
}

export function useNotePreview(note: () => Note, emit: (event: 'todoCompleted', noteId: string, todoId: string, completed: boolean) => void) {
  const expanded = ref(false)
  const remaining = computed(() => Math.max(0, note().todos.length - 3))
  function toggleExpanded() { expanded.value = !expanded.value }
  function toggleTodo(id: string, event: Event) {
    const checkbox = event.target as HTMLInputElement
    const completed = checkbox.checked
    checkbox.checked = note().todos.find(todo => todo.id === id)?.completed ?? false
    emit('todoCompleted', note().id, id, completed)
  }
  return {
    preview: computed(() => expanded.value ? note().todos : note().todos.slice(0, 3)),
    remaining,
    expanded,
    toggleExpanded,
    toggleLabel: computed(() => expanded.value ? 'Свернуть' : `Ещё задач: ${remaining.value}`),
    toggleTodo,
  }
}
