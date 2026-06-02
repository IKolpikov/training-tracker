import { useDay } from "../DayContext.jsx";
import { headerLabel } from "../utils/date.js";

// Each day's headline cardio session — shown under the date so the day's focus
// is glanceable. Hardcoded since these change with the training block, not weekly.
const DAY_THEME = {
  "Пн": "Велосипед Z2",
  "Вт": "Силовая (Hamstring)",
  "Ср": "Темповая тренировка",
  "Чт": "Длительный бег Z2",
  "Пт": "Силовая (Glute/Core)",
  "Сб": "Восстановительный бег",
  "Вс": "VO₂max интервалы",
};

export default function DayHeader() {
  const {
    viewedDate, day, goPrev, goNext, prevDisabled,
    refreshConfig, configLoading, configError, lastSync,
  } = useDay();

  // Persistent connection status next to ⟳.
  let dot = { cls: "bg-slate-600", label: "Ещё не синхронизировано" };
  if (configLoading)              dot = { cls: "bg-amber-400 animate-pulse", label: "Синхронизация…" };
  else if (lastSync?.ok)          dot = { cls: "bg-emerald-500", label: "Связь с сервером есть, данные синхронизированы" };
  else if (lastSync && !lastSync.ok) dot = { cls: "bg-rose-500", label: `Ошибка связи: ${lastSync.error || "сервер не ответил"}` };

  return (
    <header className="relative sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      {/* Build stamp — verify which bundle the browser is actually running. */}
      <span className="absolute top-0.5 right-1.5 text-[9px] leading-none text-slate-600 tabular-nums">
        {typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev"}
      </span>
      <div className="flex items-center justify-between px-2 py-3">
        <button
          onClick={goPrev}
          disabled={prevDisabled}
          className="w-12 h-12 flex items-center justify-center rounded-full text-2xl text-slate-300 active:bg-slate-800 disabled:text-slate-700 disabled:opacity-30 disabled:pointer-events-none disabled:active:bg-transparent"
          aria-label="Предыдущий день"
        >‹</button>

        <div className="flex flex-col items-center min-w-0">
        <h1 className="text-lg font-medium tracking-tight flex items-center gap-2">
          {headerLabel(viewedDate)}
          {/* Refresh: pulls Week Plan / Habbits / Польза from the sheet. */}
          <button
            onClick={refreshConfig}
            disabled={configLoading}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-slate-500 active:bg-slate-800 ${configLoading ? "animate-spin text-slate-600" : ""}`}
            aria-label="Обновить план из таблицы"
            title={configError ? `Ошибка: ${configError}` : "Обновить план из таблицы"}
          >
            <span className="text-base leading-none">⟳</span>
          </button>
          {/* Persistent connection status dot. Always visible: grey=never,
              amber=syncing, green=ok, red=error (hover for detail). */}
          <span
            className={`w-2.5 h-2.5 rounded-full ${dot.cls}`}
            aria-label={dot.label}
            title={dot.label}
          />
        </h1>
        {DAY_THEME[day] && (
          <div className="text-[11px] text-slate-500 leading-none mt-0.5 truncate max-w-full px-2">
            {DAY_THEME[day]}
          </div>
        )}
        </div>

        <button
          onClick={goNext}
          className="w-12 h-12 flex items-center justify-center rounded-full text-2xl text-slate-300 active:bg-slate-800"
          aria-label="Следующий день"
        >›</button>
      </div>
    </header>
  );
}
