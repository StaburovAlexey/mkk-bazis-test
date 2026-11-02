<script setup lang="ts">
import { NuxtLink } from '#components'
import { useAppButton, type AppButtonProps } from '~/composables/useAppButton'

const props = defineProps<AppButtonProps>()
const { element, elementProps, classes } = useAppButton(props, NuxtLink)
</script>

<template>
  <component :is="element" v-bind="elementProps" :class="classes"><slot /></component>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: .4rem;
  min-height: 2.6rem;
  padding: .5rem .85rem;
  font: inherit;
  color: inherit;
  background: #fff;
  border: 1px solid #bbc3ce;
  border-radius: 5px;
  cursor: pointer;
  text-decoration: none;

  &:hover { background: #edf0f4; }
  &:disabled { cursor: default; opacity: .5; }

  &--primary {
    background: #244e86;
    color: #fff;
    border-color: #244e86;
    &:hover { background: #1a3d6c; }
  }

  &--danger { color: #9d2631; }

  &--text {
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: #244e86;
    text-decoration: underline;
    text-underline-offset: .15em;
    &:hover { background: transparent; }
  }
}
</style>
