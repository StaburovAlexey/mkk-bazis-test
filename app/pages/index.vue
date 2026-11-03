<script setup lang="ts">
import { useNotesList } from '~/composables/useNotesList'
const list = useNotesList()
</script>

<template>
  <section class="notes-page">
    <header class="notes-page__header">
      <div><h1>Мои заметки</h1><p class="muted">Заметки и задачи в одном месте</p></div>
      <AppButton variant="primary" to="/notes/new">Создать заметку</AppButton>
    </header>
    <div v-if="list.error" class="notice" role="alert"><p>{{ list.error }}</p><AppButton @click="list.retry">Повторить загрузку</AppButton></div>
    <p v-if="!list.ready" class="muted">Загрузка заметок…</p>
    <div v-else-if="!list.notes.length" class="notes-page__empty">
      <h2>Здесь пока пусто</h2><p class="muted">Создайте первую заметку и добавьте задачи.</p>
      <AppButton to="/notes/new">Создать заметку</AppButton>
    </div>
    <section v-else class="notes-page__grid" aria-label="Заметки">
      <NoteCard v-for="note in list.notes" :key="note.id" :note="note" @delete="list.deleteNote" @todo-completed="list.setTodoCompleted" />
    </section>
    <ConfirmDialog :config="list.dialog" @choose="list.choose" />
  </section>
</template>

<style scoped lang="scss">
.notes-page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  &__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
  &__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  &__empty { text-align: center; padding: 4rem 1rem; background: #fff; border: 1px dashed #bbc3ce; border-radius: 6px; }
}
@media (max-width: 36rem) {
  .notes-page { padding: 1.5rem 1rem; &__header { flex-direction: column; } }
}
</style>
