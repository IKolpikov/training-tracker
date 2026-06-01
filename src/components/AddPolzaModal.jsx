import { useEffect, useRef, useState } from "react";

// Add-task modal for Польза. Sends the typed name to the backend → appends a row
// in the Польза sheet tab. Backend derives the id. Caller (App) refreshes config
// after success so the new item appears in the list.
export default function AddPolzaModal({ onClose, onSubmit }) {
  const [name, setName]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (e) {
      setError(String(e.message || e));
      setSaving(false);
    }
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
          className="h-12 px-3 rounded-lg bg-slate-800 border border-slate-700 text-base outline-none focus:border-amber-500"
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
        />

        {error && <div className="text-xs text-rose-400">{error}</div>}

        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium active:bg-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="flex-1 h-12 rounded-xl bg-amber-500 text-slate-950 font-semibold active:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
