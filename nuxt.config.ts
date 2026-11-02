export default defineNuxtConfig({
  compatibilityDate: '2026-11-02',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/main.scss'],
  typescript: { strict: true },
  app: {
    head: {
      title: 'Заметки',
      htmlAttrs: { lang: 'ru' },
      meta: [{ name: 'description', content: 'Заметки со списками задач' }],
    },
  },
})
