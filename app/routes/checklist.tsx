import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import * as React from "react";
import {
  STACK_ITEMS,
  CONFIDENCE_THRESHOLD,
  type ChecklistItemResult,
  type ChecklistEntry,
  type StackItem,
} from "~/lib/stack";

export const meta: MetaFunction = () => {
  return [
    { title: "STACK Entry Checklist | Risk Manager" },
    {
      name: "description",
      content: "ICT-based STACK entry checklist for trade confluence scoring.",
    },
  ];
};

type HistoryEntry = ChecklistEntry & { _id?: string };

/** State per item: checked + optional selected value */
type ItemState = { checked: boolean; value: string };

const PAIRS = ["EUR/USD", "GBP/USD", "USD/CAD", "AUD/USD", "USD/JPY", "XAU/USD"] as const;

const categoryColors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  S: { border: "border-sky-400/30", bg: "bg-sky-400/10", text: "text-sky-300", badge: "bg-sky-500" },
  T: { border: "border-violet-400/30", bg: "bg-violet-400/10", text: "text-violet-300", badge: "bg-violet-500" },
  A: { border: "border-amber-400/30", bg: "bg-amber-400/10", text: "text-amber-300", badge: "bg-amber-500" },
  C: { border: "border-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-300", badge: "bg-emerald-500" },
  K: { border: "border-rose-400/30", bg: "bg-rose-400/10", text: "text-rose-300", badge: "bg-rose-500" },
};

function emptyState(): Record<string, ItemState> {
  const s: Record<string, ItemState> = {};
  for (const item of STACK_ITEMS) {
    s[item.id] = { checked: false, value: "" };
  }
  return s;
}

export default function StackChecklist() {
  const [items, setItems] =
    React.useState<Record<string, ItemState>>(emptyState);
  const [pair, setPair] = React.useState<string>("EUR/USD");
  const [direction, setDirection] = React.useState<"long" | "short">("long");
  const [timeframe, setTimeframe] = React.useState("5m");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/checklist")
      .then((r) => r.json())
      .then((data: any) => {
        setHistory(data.entries ?? []);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  }, []);

  const totalItems = STACK_ITEMS.length;
  const checkedCount = STACK_ITEMS.filter((si) => items[si.id]?.checked).length;
  const confidencePct =
    totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Confirmation is mandatory — at least one C item must be checked
  const hasConfirmation = STACK_ITEMS.filter((si) => si.category === "C").some(
    (si) => items[si.id]?.checked,
  );
  const takeTrade = confidencePct >= CONFIDENCE_THRESHOLD && hasConfirmation;

  function setItemField(id: string, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  /** For checkbox items — simple toggle */
  function toggle(id: string) {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id].checked },
    }));
  }

  /** For select/select-or-custom — picking a value counts as checked */
  function selectValue(id: string, value: string) {
    setItems((prev) => ({
      ...prev,
      [id]: { checked: value !== "", value },
    }));
  }

  function resetChecklist() {
    setItems(emptyState());
    setNotes("");
    setSaveMsg(null);
  }

  async function saveEntry() {
    setSaving(true);
    setSaveMsg(null);

    const resultItems: ChecklistItemResult[] = STACK_ITEMS.map((si) => ({
      category: si.category,
      id: si.id,
      label: si.label,
      checked: !!items[si.id]?.checked,
      value: items[si.id]?.value || undefined,
    }));

    const entry: ChecklistEntry = {
      createdAt: new Date().toISOString(),
      pair,
      direction,
      timeframe,
      items: resultItems,
      totalItems,
      checkedItems: checkedCount,
      confidencePct,
      takeTrade,
      notes,
    };

    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if ((data as any).ok) {
        setSaveMsg("Saved!");
        setHistory((prev) => [entry, ...prev]);
        resetChecklist();
      } else {
        setSaveMsg(`Error: ${(data as any).error}`);
      }
    } catch (e: any) {
      setSaveMsg(`Network error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof STACK_ITEMS>();
    for (const item of STACK_ITEMS) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                &larr; Home
              </Link>
              <Link
                to="/calculator"
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                Calculator
              </Link>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                STACK System
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Entry Checklist
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Go through each confluence. Take the trade at{" "}
              <span className="font-semibold text-emerald-300">
                {CONFIDENCE_THRESHOLD}%+
              </span>{" "}
              confidence. Confirmation (CHoCH) is{" "}
              <span className="font-semibold text-rose-300">mandatory</span>.
            </p>
          </div>

          {/* Confidence gauge */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-full border-4 transition-colors duration-300 ${
                takeTrade
                  ? "border-emerald-400 bg-emerald-400/10"
                  : confidencePct >= 40
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-slate-600 bg-slate-800/50"
              }`}
            >
              <div className="text-center">
                <p
                  className={`text-3xl font-bold ${
                    takeTrade
                      ? "text-emerald-300"
                      : confidencePct >= 40
                      ? "text-amber-300"
                      : "text-slate-400"
                  }`}
                >
                  {confidencePct}%
                </p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">
                  confidence
                </p>
              </div>
            </div>
            <p
              className={`text-sm font-semibold ${
                takeTrade ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {takeTrade ? "TAKE THE TRADE" : "NO TRADE"}
            </p>
            {!hasConfirmation && checkedCount > 0 && (
              <p className="mt-1 text-[11px] font-medium text-rose-400">
                Confirmation required
              </p>
            )}
          </div>
        </div>

        {/* Trade context */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold text-white">Trade Setup</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Pair
              </span>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className={inputClassName}
              >
                {PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Direction
              </span>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "long" | "short")
                }
                className={inputClassName}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Timeframe
              </span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className={inputClassName}
              >
                {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Notes
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        {/* STACK checklist */}
        <section className="grid gap-6 lg:grid-cols-2">
          {grouped.map(([cat, catItems]) => {
            const colors = categoryColors[cat] ?? categoryColors.S;
            const catChecked = catItems.filter(
              (i) => items[i.id]?.checked,
            ).length;

            return (
              <div
                key={cat}
                className={`rounded-3xl border ${colors.border} bg-white/[0.04] p-6 shadow-xl backdrop-blur`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${colors.badge}`}
                    >
                      {cat}
                    </span>
                    <h3 className={`text-lg font-semibold ${colors.text}`}>
                      {catItems[0].categoryLabel}
                    </h3>
                  </div>
                  <span className="text-sm text-slate-400">
                    {catChecked}/{catItems.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {catItems.map((item) => (
                    <ChecklistItem
                      key={item.id}
                      item={item}
                      state={items[item.id] ?? { checked: false, value: "" }}
                      colors={colors}
                      onToggle={() => toggle(item.id)}
                      onSelectValue={(v) => selectValue(item.id, v)}
                      onSetCustomValue={(v) =>
                        setItemField(item.id, { value: v, checked: v !== "" })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Progress summary + actions */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                {checkedCount} of {totalItems} confluences checked
                {!hasConfirmation && checkedCount > 0 && (
                  <span className="ml-2 text-rose-400">
                    • No confirmation (CHoCH) — trade blocked
                  </span>
                )}
              </p>
              <div className="mt-2 h-3 w-64 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    takeTrade
                      ? "bg-emerald-400"
                      : confidencePct >= 40
                      ? "bg-amber-400"
                      : "bg-slate-600"
                  }`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {saveMsg && (
                <span
                  className={`text-sm ${
                    saveMsg.startsWith("Error") || saveMsg.startsWith("Network")
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {saveMsg}
                </span>
              )}
              <button
                type="button"
                onClick={resetChecklist}
                className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={saveEntry}
                disabled={saving}
                className="rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Recent Entries
          </h2>

          {historyLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500">
              No entries yet. Complete a checklist and save it.
            </p>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 20).map((entry, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                    entry.takeTrade
                      ? "border-emerald-400/20 bg-emerald-400/5"
                      : "border-white/10 bg-slate-900/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${
                        entry.takeTrade
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {entry.confidencePct}%
                    </span>
                    <span className="text-sm font-medium text-white">
                      {entry.pair}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        entry.direction === "long"
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {entry.direction}
                    </span>
                    <span className="text-xs text-slate-500">
                      {entry.timeframe}
                    </span>
                    {/* Show selected values inline */}
                    {entry.items
                      .filter((it) => it.value)
                      .map((it) => (
                        <span
                          key={it.id}
                          className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-400"
                        >
                          {it.label}:{" "}
                          <span className="font-medium text-slate-200">
                            {it.value}
                          </span>
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {entry.checkedItems}/{entry.totalItems}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    {entry.takeTrade && (
                      <span className="text-xs font-semibold text-emerald-400">
                        TRADE
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── Checklist item component ─────────────────────────────── */

function ChecklistItem(props: {
  item: StackItem;
  state: ItemState;
  colors: (typeof categoryColors)[string];
  onToggle: () => void;
  onSelectValue: (v: string) => void;
  onSetCustomValue: (v: string) => void;
}) {
  const { item, state, colors } = props;
  const isChecked = state.checked;
  const inputType = item.input;

  // ── Checkbox item ──
  if (inputType.kind === "checkbox") {
    return (
      <button
        type="button"
        onClick={props.onToggle}
        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
          isChecked
            ? `${colors.border} ${colors.bg}`
            : "border-white/10 bg-slate-900/50 hover:border-white/20"
        }`}
      >
        <Checkbox checked={isChecked} colors={colors} />
        <div>
          <p className={`text-sm font-medium ${isChecked ? "text-white" : "text-slate-200"}`}>
            {item.label}
          </p>
          <p className="mt-1 text-xs text-slate-400">{item.description}</p>
        </div>
      </button>
    );
  }

  // ── Select item (pill buttons) ──
  if (inputType.kind === "select") {
    return (
      <div
        className={`rounded-2xl border p-4 transition ${
          isChecked
            ? `${colors.border} ${colors.bg}`
            : "border-white/10 bg-slate-900/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={isChecked} colors={colors} />
          <div className="flex-1">
            <p className={`text-sm font-medium ${isChecked ? "text-white" : "text-slate-200"}`}>
              {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {inputType.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => props.onSelectValue(state.value === opt ? "" : opt)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    state.value === opt
                      ? `${colors.badge} text-white`
                      : "border border-white/10 bg-slate-800 text-slate-300 hover:border-white/20"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Select-or-custom item ──
  if (inputType.kind === "select-or-custom") {
    const isCustom = state.value !== "" && !inputType.options.includes(state.value);
    return (
      <div
        className={`rounded-2xl border p-4 transition ${
          isChecked
            ? `${colors.border} ${colors.bg}`
            : "border-white/10 bg-slate-900/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={isChecked} colors={colors} />
          <div className="flex-1">
            <p className={`text-sm font-medium ${isChecked ? "text-white" : "text-slate-200"}`}>
              {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {inputType.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => props.onSelectValue(state.value === opt ? "" : opt)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    state.value === opt
                      ? `${colors.badge} text-white`
                      : "border border-white/10 bg-slate-800 text-slate-300 hover:border-white/20"
                  }`}
                >
                  {opt}
                </button>
              ))}
              <input
                type="text"
                value={isCustom ? state.value : ""}
                onChange={(e) => props.onSetCustomValue(e.target.value)}
                placeholder={inputType.placeholder ?? "Custom…"}
                className={`w-20 rounded-xl border px-3 py-1.5 text-xs font-medium outline-none transition ${
                  isCustom
                    ? `${colors.border} ${colors.bg} text-white`
                    : "border-white/10 bg-slate-800 text-slate-300 placeholder:text-slate-500"
                } focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function Checkbox(props: { checked: boolean; colors: (typeof categoryColors)[string] }) {
  return (
    <div
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
        props.checked
          ? `${props.colors.badge} border-transparent`
          : "border-white/20 bg-transparent"
      }`}
    >
      {props.checked && (
        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20";
