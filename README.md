# SchedLinks TG (MVP)

Логин и подтверждение записей — через Telegram.

## 0) Секреты
**Не коммить**: TG_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY, APP_JWT_SECRET.

## 1) Supabase (только база)
1) Создай проект Supabase  
2) Выполни SQL из `supabase/schema.sql` (SQL Editor)  
3) Возьми:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## 2) Netlify env vars
Netlify → Site settings → Environment variables:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- TG_BOT_TOKEN
- TG_BOT_USERNAME
- APP_BASE_URL = https://soft-marshmallow-5cd9f8.netlify.app
- APP_JWT_SECRET = (любая длинная строка 32+ символа)

## 3) Telegram webhook
После деплоя:

https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook?url=https://soft-marshmallow-5cd9f8.netlify.app/.netlify/functions/tgWebhook

Проверка:
https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo

## 4) Локальный запуск
```bash
npm i
npx netlify dev
```

Локально Telegram webhook без туннеля не работает — тестируй TG после деплоя.
