import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { insertEntry, listEntries } from "~/lib/mongodb.server";
import type { ChecklistEntry } from "~/lib/stack";

function getDb(context: LoaderFunctionArgs["context"]): D1Database | null {
  const env = (context as any).cloudflare?.env ?? (context as any).env ?? {};
  return (env.DB as D1Database) ?? null;
}

/** GET /api/checklist – list recent entries */
export async function loader({ context }: LoaderFunctionArgs) {
  const db = getDb(context);
  if (!db) {
    return json({ entries: [], error: "D1 database not bound" }, 500);
  }

  try {
    const entries = await listEntries(db);
    return json({ entries, error: null });
  } catch (e: any) {
    return json({ entries: [], error: e.message }, 500);
  }
}

/** POST /api/checklist – save a new entry */
export async function action({ request, context }: ActionFunctionArgs) {
  const db = getDb(context);
  if (!db) {
    return json({ ok: false, error: "D1 database not bound" }, 500);
  }

  try {
    const body: ChecklistEntry = await request.json();
    await insertEntry(db, {
      ...body,
      createdAt: new Date().toISOString(),
    });
    return json({ ok: true, error: null });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500);
  }
}
