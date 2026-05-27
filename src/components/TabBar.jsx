// Bottom tab navigation. Always visible across all views.

const TABS = [
  { key: "sport",  label: "Тренировка" },
  { key: "habits", label: "Habits" },
  { key: "polza",  label: "Польза" },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-slate-950 border-t border-slate-800">
      <div className="mx-auto max-w-[420px] h-14 flex">
        {TABS.map(t => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex-1 text-sm font-medium transition-colors ${
                isActive
                  ? "text-emerald-400"
                  : "text-slate-500 active:text-slate-300"
              }`}
              aria-label={t.label}
              aria-current={isActive ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
