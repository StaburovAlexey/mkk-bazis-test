<script setup lang="ts">
import type { Note } from '~/types/note'
import { useNoteFormEvents } from '~/composables/useNoteEditor'
defineProps<{ note: Note; errors: Record<string, string> }>()
const emit = defineEmits<{
  title: [value: string]
  todoText: [id: string, value: string]
  todoCompleted: [id: string, value: boolean]
  removeTodo: [id: string]
  addTodo: []
  blur: []
  compositionStart: []
  compositionEnd: []
  submit: []
}>()
const { titleInput, submit } = useNoteFormEvents(emit)
</script>

<template>
  <form id="note-form" class="note-form" novalidate @submit="submit">
    <div class="note-form__title">
      <label for="note-title">Название</label>
      <input id="note-title" type="text" :value="note.title" placeholder="Без названия" @input="titleInput" @blur="emit('blur')" @compositionstart="emit('compositionStart')" @compositionend="emit('compositionEnd')" />
    </div>
    <section aria-labelledby="tasks-title">
      <h2 id="tasks-title">Задачи</h2>
      <ul v-if="note.todos.length" class="note-form__tasks">
        <TodoItem v-for="todo in note.todos" :key="todo.id" :todo="todo" :error="errors[todo.id]" @text="(id, value) => emit('todoText', id, value)" @completed="(id, value) => emit('todoCompleted', id, value)" @remove="emit('removeTodo', $event)" @blur="emit('blur')" @composition-start="emit('compositionStart')" @composition-end="emit('compositionEnd')" />
      </ul>
      <p v-else class="muted">Задач пока нет. Заметку можно сохранить и без них.</p>
      <AppButton @click="emit('addTodo')">+ Добавить задачу</AppButton>
    </section>
  </form>
</template>

<style scoped lang="scss">
.note-form {
  display: grid; gap: 2rem;
  &__title { display: grid; gap: .5rem; }
  &__tasks { display: grid; gap: .85rem; list-style: none; padding: 0; margin: 0 0 1rem; }
}
</style>
