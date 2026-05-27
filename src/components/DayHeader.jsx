import { useDay } from "../DayContext.jsx";
import { headerLabel } from "../utils/date.js";

export default function DayHeader() {
  const { viewedDate, goPrev, goNext } = useDay();
  return (
    <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="flex items-center justify-between px-2 py-3">
        <button
          onClick={goPrev}
          className="w-12 h-12 flex items-center justify-center rounded-full text-2xl text-slate-300 active:bg-slate-800"
          aria-label="Предыдущий день"
        >‹</button>

        <h1 className="text-lg font-medium tracking-tight">
          {headerLabel(viewedDate)}
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
