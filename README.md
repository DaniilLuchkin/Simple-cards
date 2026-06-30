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
5. Карточку можно удалить или перегенерировать с комментарием — как в стопке,
   так и во вкладке «Мои карточки».

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
