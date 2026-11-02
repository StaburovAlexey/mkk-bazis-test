<script setup lang="ts">
import type { Confirmation, ConfirmationChoice } from '~/composables/useConfirmDialog'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
const props = defineProps<{ config: Confirmation | null }>()
const emit = defineEmits<{ choose: [choice: ConfirmationChoice] }>()
const { dialogElement, cancel, confirm, alternative, dismiss, keydown } = useConfirmDialog(() => props.config, emit)
</script>

<template>
  <dialog ref="dialogElement" class="confirm-dialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" @cancel="cancel" @keydown="keydown">
    <template v-if="config">
      <h2 id="confirmation-title">{{ config.title }}</h2>
      <p id="confirmation-message">{{ config.message }}</p>
      <div class="actions">
        <AppButton data-safe-focus @click="dismiss">{{ config.cancelLabel || 'Остаться' }}</AppButton>
        <AppButton v-if="config.alternativeLabel" @click="alternative">{{ config.alternativeLabel }}</AppButton>
        <AppButton :variant="config.danger ? 'danger' : 'primary'" @click="confirm">{{ config.confirmLabel }}</AppButton>
      </div>
    </template>
  </dialog>
</template>

<style scoped lang="scss">
.confirm-dialog {
  width: min(34rem, calc(100% - 2rem));
  padding: 1.5rem;
  border: 1px solid #bbc3ce;
  border-radius: 7px;
  box-shadow: 0 1rem 3rem #0002;
  &::backdrop { background: #14223780; }
}
</style>
