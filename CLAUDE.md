# CLAUDE.md — Training Tracker MVP

Прочитай это первым. Полная спека — `docs/PRD.md`. Данные и ключевая логика уже написаны
в `src/data/` и `src/utils/` — НЕ переписывай их с нуля, используй как есть.

## Что строим
Mobile-first (375px) веб-приложение для трекинга ежедневной силовой тренировки.
Один экран (Day View), одно действие (залогать сет), один источник данных (Google Sheet
через Apps Script Web App). Single-user, без auth.

## Стек (зафиксирован)
- React + Vite
- Tailwind (mobile-first утилиты)
- useState + Context, без Redux
- fetch + async/await, без axios
- Бэкенд: Google Apps Script Web App (`backend/Code.gs`). НЕ Google Sheets API + OAuth.
- Offline: localStorage (`src/services/cache.js` + `sync.js`)
- Хостинг: Vercel/Netlify, free tier

## Уже готово (не трогать логику, только импортируй)
- `src/data/plan.js` — упражнения + `cardioFields`. `exerciseById` мапа.
- `src/data/schedule.js` — недельное расписание, `WEEK`, `KEY_DAYS`.
- `src/utils/date.js` — граница суток 04:00. `logicalNow()`, `getRussianDay()`,
  `getWeekNumber()`, `dateStr()`, `headerLabel()`, `isFutureDate()`, `realTimestamp()`.
- `src/utils/progress.js` — catch-up распределение силовых, `dayProgress()`, `cardState()`.
- `src/services/sheets.js` — GET логи / POST лог через Apps Script.
- `src/services/cache.js`, `sync.js` — кэш + офлайн-очередь.
- `backend/Code.gs` — бэкенд. Деплой по README.

## Что осталось построить (UI)
- `App.jsx` — состояние дня, загрузка недели через `sync.loadWeek(weekIso)`, Context.
- `components/DayHeader.jsx` — навигация по дням (`headerLabel`, стрелки/свайп, без будущего).
- `components/ExerciseList.jsx` — список карточек + разделитель `── Cardio ──`.
- `components/ExerciseCard.jsx` — имя слева, прогресс `[done/target]` справа, `[+]` (≥48×48px).
- `components/LogSetModal.jsx` — поля по типу (STR: load+reps; ISO: sec; CARDIO: из `cardioFields`).
- `components/ProgressBar.jsx` — фикс снизу, `dayProgress().pct`, red→yellow→green.

## Критичные инварианты (легко проебать)
1. **Граница суток 04:00.** Всё «сегодня» считается через `logicalNow()`. В Log колонка
   `timestamp` (A) — реальное время (`realTimestamp()`), а `date/week_iso/day` (B/C/D) — из
   `logicalNow()`. Сет в Вт 03:30 = день Пн.
2. **Плавающий target.** Карточка гаснет при `done >= strengthTargetToday(...)`, НЕ при 2/2.
   Счётчик бывает `[2/4]`. Catch-up только для STR/ISO, только на не-KEY дни (не Ср/Сб).
   Бонус НЕ добавляет новых карточек в день.
3. **Cardio не переносится.** Target = `setsPerSession`, статичный.
4. **Модалка cardio** рендерит N полей из `ex.cardioFields`, пишет в колонки L/M/N
   (distance_km/duration_min/quality_min). STR/ISO пишут в H/I/J (reps/load/unit).
5. **Optimistic UI.** На Save: `sync.logSetOptimistic(entry)` сразу (кэш+очередь+инкремент),
   запись в Sheet — в фоне; фейл → остаётся в очереди, ретрай на следующем действии/открытии.

## Acceptance criteria — см. docs/PRD.md §11 (обновлены под плавающий target)

## Границы MVP (НЕ строить) — см. docs/PRD.md §13
Гребля и темповый велосипед — post-MVP, в плане их нет.
