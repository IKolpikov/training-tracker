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

## Состояние на момент handoff (2026-06-05)

### Что в проде (live)
- **Frontend** на `training-tracker-brown.vercel.app`, последний коммит `2af4ee3`
- **Backend** Code.gs задеплоен с полным набором actions:
  `logs`/`plan`/`habits`/`polza` + `append`/`update`/`delete`/`addPolza`/`cleanupEmpty`
- **Log-таб** чистый: 106 реальных строк, 0 пустых
- **PWA Android-ready**: новый pictogram-runner, белый сплеш, maskable иконка
  с safe-zone, Service Worker для мгновенного cold-open. Установка через Chrome
  «Установить приложение». Detail ниже в [PWA / иконки / SW](#pwa--иконки--sw).
- **Last-viewed-day restore**: при открытии в течение того же логического дня
  (граница 04:00) приложение поднимается на день, где пользователь был. После
  04:00 — сброс на сегодня. Ключ `viewed_date_v1` в localStorage.
- **Тесты**: 32/32 unit (`npm test`), 9/9 backend smoke (`npm run test:backend`)

### Последние 10 коммитов
```
2af4ee3 Android PWA: maskable icon + service worker for instant cold-open
86a1408 New runner pictogram + white PWA splash + restore last-viewed day
a6cfdcb Handoff: refreshed CLAUDE.md + HANDOFF.md for new-session continuity
d87be5e Add COACH.md — self-contained instructions for an AI coach
6875bdc Favicon + app icon + PWA manifest
01f7185 Regression test: each week is a clean slate, no debt crosses Mon
0509392 Monotonic realTimestamp — eliminate same-ms collisions
28d5806 Fix the actual data-loss bug: drainQueue race overwriting concurrent pushes
160f2af Minus = simple tap; guard against empty Log rows
508960e Fix long-press threshold + ISO modal shows correct sheet defaults
```

### PWA / иконки / SW

Файлы:
- `public/icon.svg` — основная иконка, full-bleed runner (flowing-curves pictogram,
  чёрные толстые stroked-curves + filled head на белом). Используется для favicon,
  apple-touch-icon, manifest `purpose: "any"`.
- `public/icon-maskable.svg` — тот же runner, но масштабирован в safe-zone 80%
  (`transform="translate(56 56) scale(0.78)"`) для Android adaptive shapes.
  ВАЖНО: если меняешь основной SVG — поменяй и этот, paths должны совпадать.
- `public/sw.js` — Service Worker. Стратегии:
  - `/assets/*` (hashed bundles) → cache-first, immutable
  - navigation / index.html → network-first, 2s timeout, fallback к cached `/`
  - icons + manifest → cache-first
  - cross-origin (`/exec` Apps Script) → bypass, всегда сеть
  - `CACHE_VERSION = "tt-v1"` — бампать ТОЛЬКО когда меняешь логику SW; для
    обычных деплоев hashed assets сами инвалидируются.
- `public/manifest.webmanifest`:
  - `background_color: "#ffffff"` (сплеш белый, совпадает с белым фоном иконки —
    выглядит как фуллскрин лого). НЕ менять обратно на тёмный.
  - `theme_color: "#0f172a"` (адресная строка / chrome bar тёмный — под цвет
    шапки приложения).
  - 5 icon entries: 192/512 `any` + 192/512 `maskable` + SVG.
- `src/main.jsx` — регистрация SW. ОБЯЗАТЕЛЬНО `import.meta.env.PROD` guard,
  иначе в `npm run dev` SW закэширует unhashed Vite-модули → stale code.
- `scripts/gen-icons.mjs` — генерит 6 PNG: favicon-32, apple-touch-icon (180),
  icon-192/512 (any) + icon-maskable-192/512. После правки SVG — `npm run icons`.

Хард-усвоенное по PWA:
- SW ловит обновление только при следующей загрузке после деплоя. Первый
  cold-open после push в master = всё ещё старый shell. Это нормально.
- Если жалуются «не вижу новое» — попроси открыть DevTools → Application →
  Service Workers → Unregister + hard refresh. Или Chrome Android: настройки
  сайта → очистить данные.
- iOS Safari: SW работает только если приложение установлено как PWA (Add to
  Home Screen). Без установки — SW есть, но iOS его активно вытесняет.
- Maskable padding 10% — стандарт. Не делай меньше, иначе на круглых
  лаунчерах режутся конечности.

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
