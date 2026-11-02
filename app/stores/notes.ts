import { defineStore } from 'pinia'
import { useNotesState } from '../composables/useNotesState'
export const useNotesStore = defineStore('notes', () => useNotesState())
