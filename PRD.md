# Training Tracker MVP — Build Specification

**Version:** 2.0 · **Date:** 26 May 2026
**Changes vs 1.0:** cardio multi-field logging; strength catch-up redistribution; 04:00 day
rollover; backend switched to Apps Script; fixed plan JSON; acceptance criteria updated for
floating targets.

---

## 1. What We're Building

Mobile-first веб-приложение для трекинга ежедневной силовой тренировки. Один экран (Day View),
одно действие (залогать сет), один источник данных (Google Sheet через Apps Script Web App).

Распределённый подход: вместо 2 тяжёлых залов/нед — один ~25-мин круг каждое утро (2 сета на
упражнение), 5 дней/нед. Приложение трекает ежедневное выполнение против недельного плана.

## 2. Constraints

- Single user (без auth в MVP)
- Mobile-first (375px, Android)
- Google Sheets как бэкенд через Apps Script Web App
- Offline-capable (localStorage кэш + очередь записи)
- MVP = Day View + Set Logging (без week view, статы, графиков)
- **Граница суток — 04:00 local** (не полночь)
- **Силовой недобор плавно переносится** на следующие не-KEY дни недели

## 3. Google Sheet Data Source

**Sheet ID:** `1lyS3o-XYav5KDUyvxz5uCxPADEmUir1lea2tTD8D59g`

- Plan (read): tab `Coach recs, 20 may 2026`
- Schedule (read): tab `Week example`
- Logs (read+append): tab `Log` (создаётся автоматически бэкендом)

Для MVP план и расписание захардкожены в `src/data/plan.js` и `schedule.js` (см. §4) и
являются source of truth. Чтение из таблицы — опциональный фоновый refresh, не блокер.

## 4. Structured Plan Data

Готовые валидные модули — `src/data/plan.js` (`exercises`, `exerciseById`) и
`src/data/schedule.js` (`schedule`, `WEEK`, `KEY_DAYS`). Не дублировать здесь — импортировать.

Ключевое отличие от v1.0: cardio-упражнения имеют `cardioFields` — массив полей, которые
рендерит модалка и которые пишутся в Log. STR/ISO используют `defaultReps`/`defaultLoad`/`unit`.

Cardio-модель логирования:

| Упражнение | Поля (cardioFields) |
|---|---|
| Z2 run, Long Z2 | `distance_km` + `duration_min` |
| Tempo run | `distance_km` (в зачёт) + `quality_min` (темповое время, дефолт 25 = 2×12.5/нед) |
| Intervals | `distance_km` (в зачёт) + `quality_min` (время интервалов) |
| Basketball | `duration_min` |
| Z2 cycle | `duration_min` (дефолт 90, Пт) |

Post-MVP: гребля, темповый велосипед — в плане их нет.

## 5. Data Model

### 5.1 Log Entry (tab "Log") — 14 колонок

Каждая строка = один сет/одна активность.

| Col | Header | Type | STR/ISO | CARDIO | Example |
|---|---|---|---|---|---|
| A | timestamp | ISO datetime | ✓ реальное время | ✓ | `2026-05-25T07:32:00` |
| B | date | YYYY-MM-DD | ✓ логич. дата | ✓ | `2026-05-25` |
| C | week_iso | int | ✓ логич. неделя | ✓ | `22` |
| D | day | string | ✓ логич. день | ✓ | `Пн` |
| E | exercise_id | string | ✓ | ✓ | `rdl_classic` |
| F | exercise_name | string | ✓ | ✓ | `RDL classic` |
| G | set_number | int | ✓ | ✓ | `1` |
| H | reps | int | ✓ | — | `8` |
| I | load | number | ✓ | — | `120` |
| J | unit | string | ✓ | — | `kg` |
| K | notes | string | ✓ | ✓ | `""` |
| L | distance_km | number | — | run/tempo/intervals | `11` |
| M | duration_min | number | — | общее время активности | `52` |
| N | quality_min | number | — | время в темп./интерв. зоне | `25` |

STR/ISO оставляют L/M/N пустыми. CARDIO оставляет H/I/J пустыми. Лист остаётся читаемым глазами.

### 5.2 Log Tab Headers (первая строка, создаётся бэкендом)

```
timestamp | date | week_iso | day | exercise_id | exercise_name | set_number | reps | load | unit | notes | distance_km | duration_min | quality_min
```

### 5.3 Day → exercise mapping

App берёт логический день недели через `getRussianDay(logicalNow())`, ищет `schedule[day]`,
рендерит объединённые `strength` + `cardio`. Target силовых считается через
`strengthTargetToday()` (с catch-up), cardio — статичный `setsPerSession`.

## 6. UI Specification

### 6.1 Day View — без изменений в раскладке (см. v1.0 wireframe)

Header (навигация по дням) · список карточек · `── Cardio ──` разделитель · прогресс-бар снизу.

### 6.2 Exercise Card States — обновлено под плавающий target

| State | Условие | Visual |
|---|---|---|
| Not started | done == 0 | дефолт, `[+]` виден |
| In progress | 0 < done < target | partial-индикатор, `[+]` виден |
| Complete | done == target | muted/dimmed, check, `[+]` скрыт |
| Overlogged | done > target | как complete, показывает фактический счёт |

`target` для силовых = `strengthTargetToday()` и МОЖЕТ быть > setsPerSession (catch-up).
Счётчик отображается как `[done/target]`, например `[2/4]`. Логика — `cardState()` в progress.js.

### 6.3 Log Set Modal — обновлено: cardio многополевой

| Type | Поля | Pre-fill |
|---|---|---|
| STR | Load + Reps | последний сет упр. сегодня → иначе дефолты плана |
| ISO | Duration (sec) | 45 |
| CARDIO | N полей из `ex.cardioFields` | `field.default`; для distance/quality null = пусто |

Cardio: итерировать `ex.cardioFields`, на каждое поле — один input с `label` и `unit`.
На Save писать значения в соответствующие колонки L/M/N по `field.key`.

**On Save (все типы):**
1. Оптимистичный инкремент счётчика карточки + пересчёт прогресс-бара
2. `sync.logSetOptimistic(entry)` — кэш + очередь + фоновая запись
3. Фейл записи → остаётся в очереди, ретрай на следующем действии/открытии
4. Закрыть модалку

### 6.4 Header / Date Navigation

- Display: `← Пн, 25 мая →` через `headerLabel(viewedDate)`
- ←/→ или свайп меняют день; на смене — `sync.loadWeek(weekIso)` + рендер
- Сегодня (логическое) — визуальный акцент
- Будущее запрещено: `isFutureDate(viewed)` блокирует навигацию вперёд за логич. сегодня

### 6.5 Progress Bar

`dayProgress(day, dateStr, weekLogs, dayLogs)` → `{ completed, totalTarget, pct }`.
`totalTarget` = сумма `strengthTargetToday` по силовым (с catch-up) + статичные cardio-таргеты.
`completed` = сумма min(done, target) по упражнениям. Цвет red→yellow→green по порогам 33/66%.

### 6.6 Empty / Special States

| State | Display |
|---|---|
| KEY-день (Ср, Сб) | упражнения + бейдж "Key session" |
| 100% | прогресс-бар зелёный, опц. микро-анимация |
| Loading | skeleton-карточки |
| Offline | баннер сверху "Offline — saves locally" |
| Sheet error | toast "Sync failed, saved locally" |

## 7. Backend — Google Apps Script Web App

Заменяет Google Sheets API + OAuth из v1.0. Причина: single-user, минимум инфраструктуры —
никакого OAuth consent screen, service account или gapi-клиента. Один скрипт, один URL.

### 7.1 Setup (один раз)
Деплой по `README.md`. Web app, Execute as = Me, Access = Anyone. URL → `.env` (`VITE_API_URL`).

### 7.2 Read logs
```
GET {VITE_API_URL}?action=logs&week={week_iso}
→ { ok: true, rows: [ {timestamp, date, week_iso, day, exercise_id, ...}, ... ] }
```

### 7.3 Append log
```
POST {VITE_API_URL}
Content-Type: text/plain;charset=utf-8   // важно: иначе CORS preflight, который GAS не отвечает
Body: JSON-объект, keyed по заголовкам Log
→ { ok: true }
```

### 7.4 Caching (localStorage, см. src/services/cache.js)
- `logs_week_{w}` — логи недели
- `write_queue` — отложенные записи (офлайн)

On open / day change: `sync.loadWeek(weekIso)` тянет авторитетные строки, мержит непросланную
очередь сверху. Очередь дренится на каждом действии (`drainQueue`).

## 8. Catch-up Redistribution (новое в v2.0)

Готовая логика — `src/utils/progress.js::strengthTargetToday()`. Правила:

- **Только STR/ISO.** Cardio-недобор НЕ переносится (target cardio статичный).
- **Только не-KEY дни.** Дефицит садится на Пн/Вт/Чт/Пт/Вс. Ср/Сб (tempo/intervals) не получают.
- **Бонус не добавляет новых карточек.** Если упражнения нет в `schedule[day].strength` —
  target = 0, бонус ждёт ближайшего планового дня этого упражнения.
- **Недельный сброс.** Расчёт берёт только текущий `week_iso`. Недобор сгорает в воскресенье
  (граница 04:00 Вс→Пн). Долг не копится между неделями.

Формула:
```
expected  = setsPerSession × (плановых дней упр. с начала недели по сегодня)
done      = сетов упр. за текущий week_iso
behind    = max(0, expected − done)
remaining = плановые не-KEY дни упр. от сегодня до Вс включительно
bonus     = ceil(behind / remaining)
target    = base + bonus     (base = setsPerSession если упр. на карточке сегодня, иначе 0)
```

## 9. Day Rollover — 04:00 (новое в v2.0)

Граница суток = 04:00 local. Готовая логика — `src/utils/date.js`.

- Карточка Пн открыта до Вт 03:59. В Вт 04:00 переключается на Вт.
- Счётчик недели обнуляется в Пн 04:00 (граница Вс→Пн).
- Реализация: `logicalNow() = new Date(Date.now() - 4h)`. Все день/дата/неделя — от `logicalNow()`.
- **В Log:** `timestamp` (A) = реальное время (`realTimestamp()`); `date/week_iso/day` (B/C/D) =
  логические. Сет в Вт 03:30 пишется с date=Пн, day=Пн, week=прошлая.

## 10. File Structure

```
src/
├── App.jsx
├── components/{DayHeader,ExerciseCard,ExerciseList,LogSetModal,ProgressBar}.jsx
├── data/{plan,schedule}.js          ✓ готово
├── services/{sheets,cache,sync}.js  ✓ готово
└── utils/{date,progress}.js         ✓ готово
backend/Code.gs                      ✓ готово
```

## 11. Acceptance Criteria (обновлено под плавающий target и 04:00)

1. Открыть в Пн днём → видны упражнения Пн, circuit A.
2. Открыть в Вт 03:30 → всё ещё видны упражнения Пн (граница 04:00).
3. Tap [+] на RDL → модалка с 120 kg / 8 reps.
4. Save → карточка `[1/2]`, прогресс-бар обновился, строка в Sheet "Log".
5. Если за неделю RDL недобран — на следующий плановый не-KEY день target вырастет
   (напр. `[0/4]`), и карточка гаснет только при done == этому target.
6. Навигация на Ср → только ISO + Bench + бейдж "Key session"; catch-up НЕ применён.
7. Cardio Tempo run → модалка с двумя полями (дистанция + темповое время), пишет в L и N.
8. Cardio Basketball → одно поле (время), пишет в M.
9. Закрыть/открыть → прогресс сохранён (логи из Sheet по week_iso).
10. Офлайн → лог сохраняется локально, синкается при возврате связи.

## 12. Design Direction

Mobile-first, утилитарно, dark-friendly. «Планшетка в зале»: имя слева, прогресс справа,
[+] крайний правый (≥48×48px). STR — нейтральный; ISO — amber; CARDIO — blue; completed —
opacity 0.5; прогресс-бар red→yellow→green. System fonts.

## 13. What NOT to Build (MVP boundaries)

Без week view, статы/графиков, редактирования плана, таймера, Strava/Garmin, аккаунтов,
нотификаций, шаринга, ручного toggle темы. Гребля и темповый велосипед — post-MVP.
