<script setup lang="ts">
defineProps<{ canUndo: boolean; canRedo: boolean; isNew: boolean; deleted: boolean }>()
const emit = defineEmits<{ undo: []; redo: []; save: []; saveAsNew: []; cancel: []; delete: [] }>()
</script>

<template>
  <footer class="editor-actions">
    <div class="actions">
      <AppButton :disabled="!canUndo" title="Ctrl/⌘ + Z" @click="emit('undo')">↶ Отменить</AppButton>
      <AppButton :disabled="!canRedo" title="Ctrl/⌘ + Shift + Z" @click="emit('redo')">↷ Повторить</AppButton>
    </div>
    <div class="actions">
      <AppButton v-if="!isNew && !deleted" variant="danger" @click="emit('delete')">Удалить заметку</AppButton>
      <AppButton @click="emit('cancel')">Отмена</AppButton>
      <AppButton v-if="deleted" variant="primary" @click="emit('saveAsNew')">Сохранить как новую</AppButton>
      <AppButton v-else type="submit" form="note-form" variant="primary">Сохранить</AppButton>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.editor-actions { display: grid; gap: 1.2rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #d7dce3; }
</style>
