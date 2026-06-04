# HANDOFF.md — Single entry point для новой сессии Claude Code

Прошлая сессия закончилась когда у Клода кончился контекст. Этот файл —
точка входа для следующей сессии. Прочитай этот файл первым, остальное
ниже подскажет.

## TL;DR

Training Tracker — mobile-first PWA для логирования силовых/cardio тренировок
+ привычек + бэклога задач. React/Vite/Tailwind, Vercel deploy, Google Sheet
backend через Apps Script `/exec`. Single-user, без auth. Всё уже в проде и
работает; следующие фазы — RUN/CYCLE сегментные тренировки и coach-агент.

## Что прочитать в каком порядке

1. **`CLAUDE.md`** (в корне) — текущая архитектура, инварианты, conventions.
   Загружается Claude Code автоматически на старте сессии.
2. **`docs/ROADMAP.md`** — что построено, что запланировано (RUN/CYCLE phase 3,
   Garmin/Strava ingestion phase 5, Coach agent phase 6).
3. **`docs/COACH.md`** — отдельная инструкция для AI-тренера (если будешь
   работать с задачами связанными с тренером).
4. **`docs/PRD.md`** — изначальная спецификация (исторический контекст).

После этого `git log --oneline -20` → видишь последние работы.

## Состояние на момент handoff (2026-06-04)

### Что в проде (live)
- **Frontend** на `training-tracker-brown.vercel.app`, последний коммит `d87be5e`
- **Backend** Code.gs задеплоен с полным набором actions:
  `logs`/`plan`/`habits`/`polza` + `append`/`update`/`delete`/`addPolza`/`cleanupEmpty`
- **Log-таб** чистый: 106 реальных строк, 0 пустых
- **PWA** настроена: иконка бегуна, manifest, apple-touch-icon — можно «Добавить на главный экран»
- **Тесты**: 32/32 unit (`npm test`), 9/9 backend smoke (`npm run test:backend`)

### Последние 10 коммитов
```
d87be5e Add COACH.md — self-contained instructions for an AI coach
6875bdc Favicon + app icon + PWA manifest
01f7185 Regression test: each week is a clean slate, no debt crosses Mon
0509392 Monotonic realTimestamp — eliminate same-ms collisions
28d5806 Fix the actual data-loss bug: drainQueue race overwriting concurrent pushes
160f2af Minus = simple tap; guard against empty Log rows
508960e Fix long-press threshold + ISO modal shows correct sheet defaults
fe7b467 AddPolza: optimistic close + no autofill bar; day theme; drop circuit label
6907c34 chore: drop accidental .tmp-diff.patch leftover from simplify-review
00d666d Phase 41 + 39/40/42/43 + simplify pass
```

### Текущие открытые threads (приоритет)

| Что | Где описано | Статус |
|---|---|---|
| RUN/CYCLE с сегментами (бег/вело) | `ROADMAP.md` Фаза 3 | спроектировано, не построено |
| Поле «пульс» (avg/max) в cardio-логировании | `ROADMAP.md` Фаза 2 | малый шаг перед фазой 3 |
| Garmin/Strava ингест (TCX → Log) | `ROADMAP.md` Фаза 5 | спроектировано как Claude Skill |
| Coach Agent (tool calls вместо raw Log) | `ROADMAP.md` Фаза 6 + `COACH.md` | пока ручной — через COACH.md |
| Инфографика-дашборд | `ROADMAP.md` Фаза 6, end | future, после coach agent |

### Что НЕ закрыто (но и не блокирует)
- **iOS Safari aggressive eviction** — на фронте нерешаемо, защита — зелёная точка ⟳
- **Atomic append на бэке** (`getLastRow + setValues` race) — не критично пока, тригер только при параллельных записях с разных устройств. Фикс — обернуть в `LockService.getDocumentLock()`, 2 строки в Code.gs + один редеплой.

### Pending user-side actions
**Нет.** Всё что требовало ручного действия пользователя (Code.gs redeploy, Vercel env var, sheet cleanup) — сделано.

## Workflow conventions (не изобретать заново)

### Прежде чем сказать «готово»
- Прогнать `npm test` — должны проходить все
- Если трогал бэк: `npm run test:backend` — 9/9
- Если выкатил фронт: проверить `build_id` в правом верхнем углу шапки совпадает с последним коммитом (или curl `https://training-tracker-brown.vercel.app/assets/index-*.js | grep "<commit_short>"`)

### Backend redeploy
- Любая правка `backend/Code.gs` → ручной redeploy пользователем.
- Скажи явно: «вставь https://raw.githubusercontent.com/IKolpikov/training-tracker/master/backend/Code.gs → Ctrl+S → Deploy → Manage deployments → ✏️ (Edit) → Version: New version → Deploy».
- ВАЖНО: «Edit existing» не «New deployment», иначе URL изменится.

### Commits
Многострочный summary, конкретика что и почему, Co-Authored-By tag:
```
<short title>

<paragraph context>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Build stamp как диагностика
Если пользователь жалуется «не работает X» — спроси какой хеш в углу шапки. Если не равен последнему коммиту → старый кэш браузера, рекомендуй инкогнито/hard refresh.

### Tasks
Используй TaskCreate/TaskUpdate per multi-step работу. Прошлая сессия закончилась на task #48, можно создавать с #49+.

## Где собрана инфраструктура (для tool calls)

- **Sheet ID**: `1t_YwNTPT64YV-5lfMH5lIN-eypeiNIaZKB13IRcCDYk`
- **`/exec` URL**: `https://script.google.com/macros/s/AKfycbwok3O8A4Q-O9VwXwg_mczbcU29leqORsWXrko1D92QAJwtkoXHavQQGJAAELnNCZqf/exec`
- **Vercel prod**: `https://training-tracker-brown.vercel.app/` (auto-deploy на push в master)
- **GitHub repo**: `IKolpikov/training-tracker`
- **`VITE_API_URL`** настроена в Vercel env (видна в бандле)

## Шаблон сообщения для нового чата

Открываешь новый Claude Code чат в этом репо, пишешь:
```
Продолжаем проект. Прочти docs/HANDOFF.md и CLAUDE.md.
После — расскажи что сейчас в проде, что в open threads и
какие есть варианты следующих шагов.
```

CLAUDE.md загрузится автоматически, HANDOFF.md (этот файл) даст контекст
текущей сессии. Дальше — продолжаешь как обычно.

## Стиль работы (что нравилось пользователю)

- **Прямо, без воды.** Не «давайте обсудим», а «вот фикс, вот тест, вот коммит».
- **Чините через root cause, не через workaround.** Когда стали терять данные — нашёл реальный race в `drainQueue`, не «добавим ретрай».
- **Не угадывайте.** Если не уверен — фетчни сервер / прочитай Log / curl бэк и проверь.
- **Все правки → тест → коммит → пуш**, без «оставлю на потом».
- **Build stamp** в углу + красная/зелёная точка sync — главные диагностические инструменты для пользователя.
- **Backend changes требуют user action** — не забывай напоминать.

## Если пользователь скажет «продолжаем с того места»

Скорее всего речь про RUN/CYCLE фазу (фаза 3 по ROADMAP). Открой ROADMAP.md
секцию «Фазы» и спроси: «малый шаг (пульс + расчёт темпа в текущем cardio)
или сразу полный RUN/CYCLE с сегментами + новым `Running Plan` листом?»
Это последний context-checkpoint в той сессии.
