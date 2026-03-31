/**
 * D1 (SQLite) helpers for the STACK checklist.
 * Re-exports shared types/constants from stack.ts.
 */

export type { ChecklistEntry, ChecklistItemResult, StackItem } from "./stack";
export { STACK_ITEMS, CONFIDENCE_THRESHOLD } from "./stack";

import type { ChecklistEntry } from "./stack";

export async function initDb(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS checklist_entries (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        pair       TEXT    NOT NULL,
        direction  TEXT    NOT NULL,
        timeframe  TEXT    NOT NULL,
        items      TEXT    NOT NULL,
        total      INTEGER NOT NULL,
        checked    INTEGER NOT NULL,
        confidence INTEGER NOT NULL,
        take_trade INTEGER NOT NULL,
        notes      TEXT    NOT NULL DEFAULT ''
      )`,
    )
    .run();
}

export async function insertEntry(db: D1Database, entry: ChecklistEntry) {
  await initDb(db);
  await db
    .prepare(
      `INSERT INTO checklist_entries
         (created_at, pair, direction, timeframe, items, total, checked, confidence, take_trade, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.createdAt,
      entry.pair,
      entry.direction,
      entry.timeframe,
      JSON.stringify(entry.items),
      entry.totalItems,
      entry.checkedItems,
      entry.confidencePct,
      entry.takeTrade ? 1 : 0,
      entry.notes,
    )
    .run();
}

export async function listEntries(db: D1Database, limit = 50): Promise<ChecklistEntry[]> {
  await initDb(db);
  const { results } = await db
    .prepare(
      `SELECT * FROM checklist_entries ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all();

  return (results ?? []).map((row: any) => ({
    _id: String(row.id),
    createdAt: row.created_at,
    pair: row.pair,
    direction: row.direction,
    timeframe: row.timeframe,
    items: JSON.parse(row.items),
    totalItems: row.total,
    checkedItems: row.checked,
    confidencePct: row.confidence,
    takeTrade: !!row.take_trade,
    notes: row.notes,
  }));
}
