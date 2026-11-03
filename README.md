## Запуск

Нужен Node.js **22.22.3 или новее** (рекомендуется Node.js 22 LTS).

```bash
npm ci
npm run dev
```

По умолчанию приложение доступно на http://localhost:3000. Если порт занят:

```bash
npm run dev -- --port 3030
```

## Проверки

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

Vitest проверяет историю, операции стора, сохранение и восстановление данных, ошибки хранилища и обработку клавиатуры. Компонентные тесты не используются.

## Docker

```bash
docker compose up --build
```

Доступ: http://localhost:3000. Также поддерживается команда `docker-compose up` при установленном отдельном Docker Compose. При занятом порте:

```bash
APP_PORT=3030 docker compose up --build
```

Для остановки: `docker compose down`. Образ собирается в отдельном этапе, в runtime остаётся только Nuxt `.output`; процесс работает от пользователя `node`.
