import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Risk Manager" },
    {
      name: "description",
      content: "Forex risk management tools: position sizer and STACK entry checklist.",
    },
  ];
};

export default function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Risk Manager</h1>
        <p className="mt-4 max-w-md text-slate-400">
          Forex position sizing with drawdown enforcement &amp; ICT-based STACK entry checklist.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/calculator"
            className="inline-block rounded-2xl bg-sky-500 px-6 py-3 font-medium text-white transition hover:bg-sky-400"
          >
            Position Calculator
          </Link>
          <Link
            to="/checklist"
            className="inline-block rounded-2xl border border-amber-400/30 bg-amber-400/10 px-6 py-3 font-medium text-amber-200 transition hover:bg-amber-400/20"
          >
            STACK Checklist
          </Link>
        </div>
      </div>
    </main>
  );
}
