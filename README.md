# Training Tracker MVP

Mobile-first трекер силовой тренировки. React + Vite + Google Apps Script backend.

## Запуск разработки

```bash
npm create vite@latest . -- --template react   # если scaffold ещё не создан
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
# настрой content: ['./index.html','./src/**/*.{js,jsx}'] в tailwind.config.js
cp .env.example .env                            # впиши VITE_API_URL после деплоя бэкенда
npm run dev
```

## Деплой бэкенда (Apps Script) — один раз

1. Открой целевой Google Sheet → Extensions → Apps Script.
2. Вставь содержимое `backend/Code.gs`, сохрани.
3. Deploy → New deployment → type: **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Скопируй URL (`.../exec`) → вставь в `.env` как `VITE_API_URL`.
5. Вкладка `Log` создаётся автоматически при первой записи (с заголовками).

При первом запросе Google попросит авторизовать скрипт (доступ к твоим таблицам) — это
один раз, твой же аккаунт, без consent screen и OAuth-клиента.

## Деплой фронта

```bash
npm run build
# Vercel: vercel --prod   |  Netlify: netlify deploy --prod --dir=dist
# не забудь прописать VITE_API_URL в env проекта на хостинге
```

## Структура
- `src/data/` — план и расписание (hardcoded fallback, source of truth для MVP)
- `src/utils/` — даты (граница 04:00) и прогресс (catch-up)
- `src/services/` — Apps Script API, кэш, офлайн-очередь
- `src/components/` — UI (строит Claude Code по CLAUDE.md)
- `backend/Code.gs` — Apps Script Web App
- `docs/PRD.md` — полная спека
