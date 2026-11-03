<script setup lang="ts">
import type { Note } from '~/types/note'
import { useNotePreview } from '~/composables/useNotesList'
const props = defineProps<{ note: Note }>()
const emit = defineEmits<{
  delete: [id: string]
  todoCompleted: [noteId: string, todoId: string, completed: boolean]
}>()
const { preview, remaining, expanded, toggleExpanded, toggleLabel, toggleTodo } = useNotePreview(() => props.note, emit)
</script>

<template>
  <article class="note-card">
    <h2 class="note-card__title"><NuxtLink :to="`/notes/${note.id}`">{{ note.title || 'Без названия' }}</NuxtLink></h2>
    <ul v-if="preview.length" :id="`note-todos-${note.id}`" class="note-card__preview">
      <li v-for="todo in preview" :key="todo.id" class="note-card__todo">
        <input type="checkbox" :checked="todo.completed" :aria-label="todo.text" @change="toggleTodo(todo.id, $event)" />
        <span :class="{ 'note-card__completed': todo.completed }">{{ todo.text }}</span>
      </li>
    </ul>
    <p v-else class="muted">Нет задач</p>
    <AppButton v-if="remaining" variant="text" class="note-card__toggle" :aria-expanded="expanded" :aria-controls="`note-todos-${note.id}`" @click="toggleExpanded">{{ toggleLabel }}</AppButton>
    <div class="actions note-card__actions">
      <AppButton :to="`/notes/${note.id}`">Редактировать</AppButton>
      <AppButton variant="danger" @click="emit('delete', note.id)">Удалить</AppButton>
    </div>
  </article>
</template>

<style scoped lang="scss">
.note-card {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid #d7dce3;
  border-radius: 6px;
  background: #fff;
  &__title { overflow-wrap: anywhere; margin-bottom: .4rem; }
  &__preview { list-style: none; padding: 0; margin: 0 0 .7rem; }
  &__todo { display: flex; align-items: flex-start; gap: .65rem; margin: .4rem 0; overflow-wrap: anywhere; }
  &__todo input { flex-shrink: 0; }
  &__completed { text-decoration: line-through; color: #596271; }
  &__toggle { align-self: flex-start; }
  &__actions { margin-top: auto; }
}
</style>
