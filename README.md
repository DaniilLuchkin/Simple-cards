# Simple Cards

Telegram Mini App для изучения английских слов. Пришли боту слово, фразу или
фото — он сгенерирует карточку через LLM (OpenRouter). Повторение карточек —
свайпами влево/вправо («забыл» / «помню») по алгоритму SuperMemo-2 (как в Anki).

## Структура

- `server/` — Express API + Telegram-бот (grammy) + Prisma/PostgreSQL, один процесс.
- `web/` — Telegram Mini App (React + Vite + Tailwind), открывается кнопкой в боте.

## Как это работает

1. Пользователь пишет боту слово (`cat`), слово с примером (`cat\nThe cat is sleeping.`)
   или присылает фото со словом в подписи. LLM (через OpenRouter) генерирует:
   простое объяснение на английском, перевод на русский, при необходимости — пример.
2. Карточка сохраняется с начальным SM2-состоянием (`dueAt = now`).
3. В Mini App открывается стопка карточек, у которых наступил срок повторения.
   Лицевая сторона — слово + пример (+ фото). Тап переворачивает карточку:
   объяснение на простом английском и заблюренный перевод (тап — открыть).
4. Свайп вправо = «помню» (следующий показ позже), влево = «забыл» (раньше) —
   пересчитывается через `server/src/sm2.ts`.
5. Новая карточка сразу попадает в колоду — отдельного экрана подтверждения
   нет (см. «Известные упрощения» ниже про этот выбор).
6. Во вкладке «Мои карточки» — список всех карточек. Тап открывает карточку
   целиком (можно перевернуть и посмотреть обе стороны), там же — ручное
   редактирование полей, перегенерация через LLM с комментарием и удаление.
   Из стопки повторения тоже можно удалить/перегенерировать текущую карточку.

## Быстрый старт (локально)

### 1. Зависимости и инфраструктура

```bash
pnpm install
docker compose up -d   # postgres + minio (S3-совместимое хранилище картинок)
```

В MinIO консоли (http://localhost:9001, simplecards/simplecards123) создайте
публичный bucket `simple-cards` (Access Policy → Public/Read для папки `cards/`),
либо через `mc`:

```bash
mc alias set local http://localhost:9000 simplecards simplecards123
mc mb local/simple-cards
mc anonymous set download local/simple-cards
```

### 2. Сервер

```bash
cd server
cp .env.example .env   # заполните TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY, MINI_APP_URL
pnpm prisma:migrate     # создаст таблицы
pnpm dev                 # API на :3000 + бот (long polling)
```

Бота создаёте через [@BotFather](https://t.me/BotFather): `/newbot`, токен — в
`TELEGRAM_BOT_TOKEN`. `MINI_APP_URL` — это публичный HTTPS-адрес фронтенда
(на проде; локально для теста кнопки в боте можно прокинуть `web` через ngrok/cloudflared,
Telegram требует HTTPS для Web App).

OpenRouter: ключ на https://openrouter.ai/keys, модель задаётся `OPENROUTER_MODEL`
(например `anthropic/claude-3.5-haiku`, `openai/gpt-4o-mini` — переключайте свободно,
для генерации по фото нужна модель с поддержкой vision).

### 3. Mini App

```bash
cd web
cp .env.example .env   # VITE_API_URL=http://localhost:3000
pnpm dev                 # http://localhost:5173
```

Откройте через сам Telegram (Web App), чтобы `window.Telegram.WebApp.initData`
был доступен — без него API отвечает 401 (см. `server/src/middleware/telegramAuth.ts`).
Для удобной разработки в браузере без Telegram потребуется временно замокать
`initData`/auth — в текущей версии аутентификация всегда требует реальный Telegram.

## Деплой на Railway

Репозиторий — pnpm-монорепо (`server/` + `web/`), на Railway это два отдельных
сервиса из одного репо, плюс плагин Postgres. Объектное хранилище (картинки)
Railway "из коробки" не предоставляет — нужен внешний S3-совместимый сервис,
проще всего [Cloudflare R2](https://developers.cloudflare.com/r2/) (есть
бесплатный тариф, S3 API совместим 1-в-1 с тем, что уже реализовано в
`server/src/storage/s3.ts`) или Backblaze B2.

1. **Postgres** — в Railway-проекте: `New` → `Database` → `PostgreSQL`. Получите
   переменную `DATABASE_URL` (или ссылайтесь на неё из сервиса `server` как
   `${{ Postgres.DATABASE_URL }}`).

2. **Сервис `server`** — `New` → `GitHub Repo` → этот репозиторий.
   - Settings → Build: Build Command —
     `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @simple-cards/server build`
   - Settings → Deploy: Start Command — `pnpm --filter @simple-cards/server start`
     (он сам прогонит `prisma migrate deploy` перед запуском, см. `server/package.json`)
   - Variables: всё из `server/.env.example`, кроме `PORT` (его задаёт Railway
     автоматически — Express и так слушает `process.env.PORT`). `DATABASE_URL`
     возьмите из Postgres-плагина. `S3_*` — данные вашего R2/B2 bucket.
     `CORS_ORIGIN` и `MINI_APP_URL` — публичный домен сервиса `web` (Railway
     выдаёт `*.up.railway.app`, либо подключите свой домен).
   - Держите **1 instance/replica** — бот работает через long polling, два
     одновременных процесса будут конфликтовать за апдейты.

3. **Сервис `web`** — тот же репозиторий, отдельный сервис.
   - Build Command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @simple-cards/web build`
   - Start Command: `pnpm --filter @simple-cards/web start` (статика из `dist/`
     отдаётся через `serve`, слушает `$PORT`)
   - Variables: `VITE_API_URL` = публичный домен сервиса `server`. Это
     **build-time** переменная (Vite вшивает её на этапе сборки) — задайте её
     до первого деплоя, при смене значения нужен redeploy с пересборкой.

4. В BotFather командой `/setmenubutton` (или `/newapp`) укажите тот же URL
   сервиса `web` — это то, что откроется по кнопке в боте.

## Алгоритм повторения

`server/src/sm2.ts` — классический SM2: свайп вправо = quality 4, влево = quality 1.
Интервалы считаются в днях (минимум 1 день после «забыл», как в ванильном SM2,
без коротких internal relearning-шагов Anki).

## Дизайн

Минималистичный, пастельные полупрозрачные тона на белом фоне — палитра задана
в `web/tailwind.config.js` (`sky`, `mint`, `lilac`, `peach`, `blush`, `butter`),
использована с низкой непрозрачностью (`/30`–`/50`) поверх белого.

## Известные упрощения MVP

- Изображение учитывается LLM только если модель в OpenRouter поддерживает vision.
- Состояние "жду слово к присланному фото" хранится в памяти процесса бота
  (не переживёт рестарт/масштабирование на несколько инстансов).
- Нет отдельного экрана логина — единственный способ использования это Telegram Mini App.
- Сгенерированная карточка добавляется в колоду сразу, без отдельного шага
  подтверждения — осознанный выбор (см. историю изменений), правки и удаление
  доступны позже во вкладке «Мои карточки» или прямо в стопке повторения.
