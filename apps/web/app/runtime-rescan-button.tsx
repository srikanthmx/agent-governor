"use client";

export function RuntimeRescanButton() {
  return (
    <button
      className="h-8 rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] px-3 text-xs font-medium text-[var(--ag-soft)] hover:border-[var(--ag-cyan)] hover:text-[var(--ag-heading)]"
      onClick={() => window.location.reload()}
      type="button"
    >
      Rescan local agents
    </button>
  );
}
