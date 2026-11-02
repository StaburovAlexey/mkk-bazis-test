<template>
  <main class="app-shell">
    <NuxtPage />
  </main>
</template>

<style scoped lang="scss">
.app-shell { max-width: 880px; padding: 2rem 1rem 4rem; margin: 0 auto; }
@media (max-width: 480px) { .app-shell { padding-top: 1rem; } }
</style>
