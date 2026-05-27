import { useEffect } from "react";

// Floating snackbar with an Undo action. Auto-dismisses after 5 seconds.
// Positioned above the TabBar (bottom-20) so it never overlaps tab controls.
export default function UndoSnackbar({ message, onUndo, onDismiss, timeoutMs = 5000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(t);
  }, [onDismiss, timeoutMs]);

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto bg-slate-800 border border-slate-700 text-slate-100 rounded-full pl-4 pr-2 py-1.5 shadow-lg flex items-center gap-3 max-w-[420px] w-full">
        <span className="text-sm flex-1 truncate">{message}</span>
        <button
          onClick={onUndo}
          className="text-emerald-400 text-sm font-semibold px-3 py-1.5 rounded-full active:bg-slate-700"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
