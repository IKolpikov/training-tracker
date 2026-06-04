# CLAUDE.md — Training Tracker

Прочитай это первым. Полный контекст — `docs/PRD.md`, дальнейшее развитие — `docs/ROADMAP.md`,
актуальная сессия — `docs/HANDOFF.md`, отдельная инструкция для тренера-нейросети —
`docs/COACH.md`.

## Что это
Mobile-first single-user веб-приложение для трекинга ежедневной тренировки и привычек.
Один Google Sheet как backend через Apps Script Web App. Без auth.

## Стек (зафиксирован)
- **React + Vite + Tailwind** (no Redux, useState/useMemo + крошечный module-level configStore)
- **Backend**: `backend/Code.gs` — Apps Script Web App. НЕ Sheets API + OAuth.
- **Sheet ID**: `1t_YwNTPT64YV-5lfMH5lIN-eypeiNIaZKB13IRcCDYk` (план + Log в одном файле)
- **/exec URL**: `https://script.google.com/macros/s/AKfycbwok3O8A4Q-O9VwXwg_mczbcU29leqORsWXrko1D92QAJwtkoXHavQQGJAAELnNCZqf/exec`
- **Hosting**: Vercel (auto-deploy on push to master). Frontend → `training-tracker-brown.vercel.app`.
- **Offline**: localStorage (`src/services/cache.js` + `sync.js`) — кэш + три очереди (append/update/delete).
- **PWA**: `public/manifest.webmanifest` + apple-touch-icon → можно «Добавить на главный экран».

## Архитектура данных

Источник истины — **Google Sheet**, 5 вкладок:
- `Week Plan May 2026` — план (день × упражнение × sets/reps/load) → читается через `?action=plan`
- `Total load plan May 2026` — справочная сводка, **не читается** приложением
- `Habbits` — расписание привычек → `?action=habits`
- `Польза` — бэклог задач → `?action=polza`
- `Log` — append-only факт (14 колонок) → `?action=logs[&week=N]`

Frontend boot:
1. `src/data/configStore.js` стартует из localStorage cache → defaults (`src/data/defaults.js`)
2. `App` на mount: cache → server fetch (`fetchConfig`) → store update
3. `useConfig()` хук подписан на store — компоненты ререндерятся при refresh
4. ⟳ кнопка в DayHeader перечитывает: config + Польза-state + logs текущей недели + слив очереди

## Критичные инварианты (легко проебать)

1. **Граница суток 04:00 local.** Через `logicalNow()` в `src/utils/date.js`. Сет в Вт 03:30 = логически **Пн**. В Log колонка `timestamp` — реальное UTC время (`realTimestamp()` мс-точность, **монотонный per device**), `date`/`week_iso`/`day` — логические от `logicalNow()`.

2. **Недели независимы.** Carry-math в `src/utils/progress.js` строго в рамках текущей `weekLogs = logsMap[weekIso]`. Каждый Пн — чистый лист. Долг через границу не переносится.

3. **Карточка-счётчик = единственный источник истины «сделано».** Модалка (`MultiSetModal`) НЕ создаёт логи — только правит уже залогированные (через `?action=update`) и стэшит будущие значения в `pending` (localStorage). Тап [+] на карточке материализует.

4. **append-only Log + 3 очереди**: append (write_queue), update (update_queue), delete (delete_queue). drainQueue с auto-retry если за время drain что-то добавили (race fix).

5. **timestamp ms-precision и монотонный.** В `src/utils/date.js::realTimestamp` — счётчик гарантирует уникальность даже при двух вызовах в одну мс. Это primary key для update/delete и dedup в loadWeek.

6. **carry-math (`progress.js::strengthTargetToday`)**: walk scheduled days, дефицит/профицит едет на ближайший следующий scheduled-день того же упражнения. Cardio — без carry.

7. **Optimistic UI**: на тап → cache+queue+state обновляются СРАЗУ, POST в фоне → drainQueue. Зелёная точка возле ⟳ = реальный round-trip (write/read landed).

8. **Build stamp**: `__BUILD_ID__` (commit short SHA) виден в правом верхнем углу шапки. Чтобы понять что у пользователя в браузере — спроси этот хеш.

9. **Backend writes only**: `appendLog`, `updateLog`, `deleteLog`, `addPolzaTask`. **Плана через API нельзя поменять** — только через ручную правку Sheet (план — это инпут от тренера, не от приложения).

10. **Перенос через границу 04:00** — `date`/`week_iso`/`day` поля считаются от `logicalNow()`, НЕ от `Date.now()`. Если меняешь логику — обязательно сохрани этот инвариант.

## Файлы по теме (don't reinvent)

```
src/
├── App.jsx                       # центральный state, handlers, refresh orchestration
├── DayContext.jsx                # context для дочерних компонентов
├── useConfig.js                  # хук поверх configStore
├── data/
│   ├── configStore.js            # singleton + subscribe pattern
│   ├── defaults.js               # bootstrap fallback (re-exports из plan/schedule/habits/polza)
│   ├── plan.js, schedule.js      # hardcoded defaults (fallback)
│   ├── habits.js, polza.js       # habit_*/polza_* префиксы + хелперы
├── services/
│   ├── sheets.js                 # postAction_/getAction_ обёртки над /exec
│   ├── config.js                 # buildPlanConfig / buildHabitsConfig / buildPolzaConfig + cache
│   ├── cache.js                  # makeQueue фабрика, 3 очереди в localStorage
│   ├── sync.js                   # logSetOptimistic / applyEditOptimistic / removeOptimistic + drainQueue
│   ├── pending.js                # стэш значений для будущих сетов (modal → quickLog handoff)
├── utils/
│   ├── date.js                   # logicalNow, realTimestamp (монотонный), headerLabel
│   ├── progress.js               # strengthTargetToday (carry), dayProgress, cardState
│   ├── slug.js                   # frontend slugify (зеркалит backend slugify_)
└── components/
    ├── ExerciseCard.jsx          # карточка + [+] + invisible-tap-left для минуса
    ├── MultiSetModal.jsx         # data-entry only, НЕ создаёт логи
    ├── DayHeader.jsx             # date + ⟳ + sync-dot + день-тема
    └── ...

backend/
├── Code.gs                       # /exec endpoint — actions: logs/plan/habits/polza + append/update/delete/addPolza/cleanupEmpty
└── smoke-test.sh                 # `npm run test:backend` — 9 проверок против живого бэка
```

## Workflow & conventions

### Build / Test / Deploy
- `npm test` — vitest unit (~30+ тестов: progress carry math, config parsing, monotonic timestamp)
- `npm run test:backend` — bash smoke против живого `/exec` (config endpoints, round-trip без tz/мс потерь, delete, no-dup)
- `npm run build` — Vite build, sanity check
- `npm run icons` — перегенерить PNG из `public/icon.svg`
- Frontend auto-deploys через Vercel **на push в master**
- Backend — **ручной redeploy** через Apps Script UI (Manage deployments → Edit → New version → Deploy). URL остаётся тот же.

### Commits
Многострочный summary, Co-Authored-By tag в конце:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Tasks
Используй TaskCreate перед началом, TaskUpdate (in_progress → completed) по ходу.

### Запросы пользователя
- На «делай X автономно» — НЕ спрашивай подтверждения промежуточные, доводи до коммита+пуша.
- На «проверь» — гоняй смоук/тесты перед утверждением.
- На «выкатил?» — curl бандл с прода и сверь build_id с последним коммитом.
- Перед каждым «готово» — фактический прогон тестов (`npm test`) + (если бэк трогали) `npm run test:backend`.

### Backend redeploy — что требует
Любая правка `backend/Code.gs` → нужен ручной redeploy от пользователя. Скажи явно: «вставь свежий https://raw.githubusercontent.com/IKolpikov/training-tracker/master/backend/Code.gs → Ctrl+S → Deploy → Manage deployments → ✏️ → New version → Deploy». Описывай что именно добавилось.

## Hard-learned (не наступать снова)
- `setNumberFormat("@")` для колонок timestamp/date/L/M/N **обязательно** — без этого Sheets парсит ISO-строки как Date и сдвигает по tz / схлопывает `8.20` → `8.2`.
- `drainQueue` должен **перечитывать очередь после await** и удалять только успешно отправленные — `set(remaining)` blind overwrite терял конкурентные пуши.
- `realTimestamp` **должен** быть монотонным per device — иначе два лога в одну мс получают одинаковый id → dedup в `loadWeek` съедает один → визуальная «потеря».
- `appendLog` должен отбивать пустые entries — иначе любая ошибка цепочки приводит к мусорным empty-rows в Log.
- iOS Safari aggressive memory eviction — оптимистичная очередь может пропасть с фоновой вкладки. Защититься чисто на фронте нельзя; зелёная точка ⟳ — главный сигнал «дошло» для пользователя.
- carry-math должен брать только **закрытые** дни (`priorIdx < actualTodayIdx`); сегодня — open day, используем `min(0, base+carry)` чтобы deficit «оседал» на нём, а не дублировался на будущих.

## Что не строить
- Не плодить второй лог (для бега/привычек/польза). Один Log на всё, type выводится из префикса id.
- Не парсить план из свободного текста (план = строки в Sheet).
- Не делать API для обновления `Week Plan` — это контракт «тренер пишет в Sheet, приложение читает».
- Не округлять секунды в cardio-полях (формат m.ss требует точности).
