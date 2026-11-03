<script setup lang="ts">
import { useNoteEditor } from '~/composables/useNoteEditor'
const editor = useNoteEditor()
</script>

<template>
  <section class="editor-page">
    <header class="editor-page__header">
      <NuxtLink to="/">← Все заметки</NuxtLink>
      <h1>{{ editor.editorTitle }}</h1>
      <p v-if="editor.ready && !editor.missing" class="muted" role="status">{{ editor.dirty ? 'Есть несохранённые изменения' : 'Изменений нет' }}</p>
    </header>
    <div v-if="editor.error" class="notice editor-page__notice" role="alert">
      <p>{{ editor.error }}</p>
      <AppButton v-if="editor.savedWithDraftError" @click="editor.retryDraftClear">Удалить черновик и выйти</AppButton>
    </div>
    <p v-if="!editor.ready" class="muted">Открываем заметку…</p>
    <section v-else-if="editor.missing" class="editor-page__missing">
      <h2>Заметка не найдена</h2>
      <p class="muted">Возможно, она была удалена или адрес указан неверно.</p>
      <AppButton to="/">Вернуться к заметкам</AppButton>
    </section>
    <template v-else-if="!editor.savedWithDraftError">
      <p v-if="editor.deletedElsewhere" class="notice editor-page__notice" role="status">Эта заметка удалена в другой вкладке. Ваши изменения остались здесь — их можно сохранить как новую заметку.</p>
      <NoteForm :note="editor.note" :errors="editor.todoErrors" @title="editor.setTitle" @blur="editor.flushText" @todo-text="editor.setTodoText" @todo-completed="editor.setTodoCompleted" @remove-todo="editor.removeTodo" @add-todo="editor.addTodo" @composition-start="editor.compositionStart" @composition-end="editor.compositionEnd" @submit="editor.save" />
      <EditorActions :can-undo="editor.canUndo" :can-redo="editor.canRedo" :is-new="editor.isNew" :deleted="editor.deletedElsewhere" @undo="editor.undo" @redo="editor.redo" @save="editor.save" @save-as-new="editor.saveAsNew" @cancel="editor.cancel" @delete="editor.deleteNote" />
    </template>
    <ConfirmDialog :config="editor.dialog" @choose="editor.choose" />
  </section>
</template>

<style scoped lang="scss">
.editor-page {
  max-width: 54rem; padding: 2.5rem 1.5rem; margin: 0 auto;
  &__header { margin-bottom: 1.75rem; }
  &__header h1 { margin: 1.25rem 0 .5rem; }
  &__notice { margin-bottom: 1.5rem; }
  &__notice p:last-child { margin-bottom: 0; }
  &__missing { padding: 2rem 0; }
}
@media (max-width: 36rem) { .editor-page { padding: 1.5rem 1rem; } }
</style>
