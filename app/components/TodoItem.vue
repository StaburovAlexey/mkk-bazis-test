<script setup lang="ts">
import type { Todo } from '~/types/note'
import { useTodoItemEvents } from '~/composables/useNoteEditor'
const props = defineProps<{ todo: Todo; error?: string }>()
const emit = defineEmits<{
  text: [id: string, value: string]
  completed: [id: string, value: boolean]
  remove: [id: string]
  blur: []
  compositionStart: []
  compositionEnd: []
}>()
const { input, toggle, remove } = useTodoItemEvents(() => props.todo, emit)
</script>

<template>
  <li class="todo-item">
    <input class="todo-item__check" type="checkbox" :checked="todo.completed" :aria-label="`Отметить задачу: ${todo.text || 'Новая задача'}`" @change="toggle" />
    <div class="todo-item__field">
      <label class="sr-only" :for="`todo-${todo.id}`">Текст задачи</label>
      <input :id="`todo-${todo.id}`" type="text" :value="todo.text" placeholder="Что нужно сделать?" :class="{ 'todo-item__completed': todo.completed }" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? `todo-error-${todo.id}` : undefined" @input="input" @blur="emit('blur')" @compositionstart="emit('compositionStart')" @compositionend="emit('compositionEnd')" />
      <p v-if="error" :id="`todo-error-${todo.id}`" class="error todo-item__error">{{ error }}</p>
    </div>
    <AppButton variant="danger" :aria-label="`Удалить задачу: ${todo.text || 'Новая задача'}`" @click="remove">Удалить</AppButton>
  </li>
</template>

<style scoped lang="scss">
.todo-item {
  display: flex; align-items: flex-start; gap: .75rem;
  &__check { flex-shrink: 0; margin-top: .8rem; }
  &__field { flex: 1; min-width: 0; }
  &__completed { text-decoration: line-through; color: #596271; }
  &__error { font-size: .875rem; margin: .35rem 0 0; }
}
@media (max-width: 30rem) {
  .todo-item { flex-wrap: wrap; gap: .5rem; &__field { flex-basis: calc(100% - 2.5rem); } > button { margin-left: 2rem; } }
}
</style>
