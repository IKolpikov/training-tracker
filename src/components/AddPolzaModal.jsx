import { useEffect, useRef, useState } from "react";

// Add-task modal. Done = close immediately (parent handles optimistic add +
// background sync). Disables Chrome's autofill bar (key/card/pin icons that
// appeared as the "extra black bar" on mobile).
export default function AddPolzaModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed); // fire-and-forget; parent owns server sync
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-6 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-lg font-semibold">Новое дело</div>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Что нужно сделать?"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-12 px-3 rounded-lg bg-slate-800 border border-slate-700 text-base outline-none focus:border-amber-500"
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
        />

        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium active:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 h-12 rounded-xl bg-amber-500 text-slate-950 font-semibold active:bg-amber-400 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
