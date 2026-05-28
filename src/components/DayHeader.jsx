import { useDay } from "../DayContext.jsx";
import { headerLabel } from "../utils/date.js";

export default function DayHeader() {
  const {
    viewedDate, goPrev, goNext, prevDisabled,
    refreshConfig, configLoading, configError, syncOk,
  } = useDay();

  return (
    <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="flex items-center justify-between px-2 py-3">
        <button
          onClick={goPrev}
          disabled={prevDisabled}
          className="w-12 h-12 flex items-center justify-center rounded-full text-2xl text-slate-300 active:bg-slate-800 disabled:text-slate-700 disabled:opacity-30 disabled:pointer-events-none disabled:active:bg-transparent"
          aria-label="Предыдущий день"
        >‹</button>

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
          {/* Green check: flashes 1s when a real backend exchange is confirmed
              (write landed on server, or config came back non-empty). */}
          {syncOk && (
            <span
              className="text-emerald-400 text-base leading-none animate-pulse"
              aria-label="Синхронизировано с сервером"
              title="Данные ушли на сервер"
            >✓</span>
          )}
        </h1>

        <button
          onClick={goNext}
          className="w-12 h-12 flex items-center justify-center rounded-full text-2xl text-slate-300 active:bg-slate-800"
          aria-label="Следующий день"
        >›</button>
      </div>
    </header>
  );
}
