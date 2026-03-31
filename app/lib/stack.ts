/* ── Shared types & constants for STACK checklist ──────────── */
/* This file is safe to import from both client and server.    */

export interface ChecklistEntry {
  _id?: string;
  createdAt: string;           // ISO-8601
  pair: string;                // e.g. "EUR/USD"
  direction: "long" | "short";
  timeframe: string;           // e.g. "5m", "1h"
  items: ChecklistItemResult[];
  totalItems: number;
  checkedItems: number;
  confidencePct: number;       // 0-100
  takeTrade: boolean;          // confidence >= threshold
  notes: string;
}

export interface ChecklistItemResult {
  category: string;  // S, T, A, C, K
  id: string;
  label: string;
  checked: boolean;
  value?: string;    // selected option for dropdown items
}

/** Input type for a checklist item */
export type ItemInputType =
  | { kind: "checkbox" }
  | { kind: "select"; options: string[] }
  | { kind: "select-or-custom"; options: string[]; placeholder?: string };

export interface StackItem {
  category: string;
  categoryLabel: string;
  id: string;
  label: string;
  description: string;
  input: ItemInputType;
}

export const STACK_ITEMS: StackItem[] = [
  // S – Structure / Bias
  {
    category: "S",
    categoryLabel: "Structure / Bias",
    id: "s-daily",
    label: "Daily bias",
    description: "Daily timeframe shows clear bullish or bearish bias",
    input: { kind: "select", options: ["Bullish", "Bearish"] },
  },
  {
    category: "S",
    categoryLabel: "Structure / Bias",
    id: "s-4h",
    label: "4H bias",
    description: "4-hour structure aligns with daily bias direction",
    input: { kind: "select", options: ["Bullish", "Bearish"] },
  },
  {
    category: "S",
    categoryLabel: "Structure / Bias",
    id: "s-1h",
    label: "1H bias",
    description: "1-hour structure aligns with higher timeframe bias",
    input: { kind: "select", options: ["Bullish", "Bearish"] },
  },

  // T – Trend
  {
    category: "T",
    categoryLabel: "Trend",
    id: "t-direction",
    label: "Trend direction",
    description: "Clear trend direction established on relevant timeframes",
    input: { kind: "select", options: ["Uptrend", "Downtrend"] },
  },
  {
    category: "T",
    categoryLabel: "Trend",
    id: "t-bos",
    label: "Break of Structure (BoS)",
    description: "Break of structure identified confirming trend continuation",
    input: { kind: "checkbox" },
  },
  {
    category: "T",
    categoryLabel: "Trend",
    id: "t-choch",
    label: "Change of Character (CHoCH)",
    description: "CHoCH identified if looking for reversal or trend shift",
    input: { kind: "checkbox" },
  },

  // A – Area of Interest
  {
    category: "A",
    categoryLabel: "Area of Interest",
    id: "a-ote",
    label: "At Optimal Trade Entry (OTE)",
    description: "Price is at the 62–79% Fibonacci retracement zone",
    input: { kind: "checkbox" },
  },
  {
    category: "A",
    categoryLabel: "Area of Interest",
    id: "a-ob",
    label: "Order Block (OB) present",
    description: "Relevant order block identified near OTE zone",
    input: { kind: "checkbox" },
  },
  {
    category: "A",
    categoryLabel: "Area of Interest",
    id: "a-fvg",
    label: "Fair Value Gap (FVG) present",
    description: "FVG / imbalance identified near OTE zone",
    input: { kind: "checkbox" },
  },

  // C – Confirmation
  {
    category: "C",
    categoryLabel: "Confirmation",
    id: "c-ext-choch",
    label: "External CHoCH on 5min",
    description: "Change of character confirmed on 5-minute timeframe",
    input: { kind: "checkbox" },
  },
  {
    category: "C",
    categoryLabel: "Confirmation",
    id: "c-int-choch",
    label: "Internal CHoCH (iCHoCH)",
    description: "Internal change of character confirmed on lower timeframe",
    input: { kind: "checkbox" },
  },

  // K – Knowledge / Risk Management
  {
    category: "K",
    categoryLabel: "Knowledge / Risk",
    id: "k-risk-aligned",
    label: "Aligns with risk management rules",
    description: "Trade fits within weekly and monthly drawdown limits",
    input: { kind: "checkbox" },
  },
  {
    category: "K",
    categoryLabel: "Knowledge / Risk",
    id: "k-rr",
    label: "Reward-to-Risk ratio",
    description: "Minimum reward-to-risk multiple for this setup",
    input: { kind: "select-or-custom", options: ["2R", "3R", "4R", "5R"], placeholder: "e.g. 6R" },
  },
  {
    category: "K",
    categoryLabel: "Knowledge / Risk",
    id: "k-position-size",
    label: "Position size within limits",
    description: "Lot size validated against the risk engine calculator",
    input: { kind: "checkbox" },
  },
];

export const CONFIDENCE_THRESHOLD = 60;
