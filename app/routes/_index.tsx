import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Forex Size Calculator" },
    {
      name: "description",
      content: "Position size calculator with weekly and monthly drawdown enforcement.",
    },
  ];
};

export default function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Forex Size Calculator</h1>
        <p className="mt-4 text-slate-400">
          Position sizing with weekly &amp; monthly drawdown enforcement.
        </p>
        <Link
          to="/calculator"
          className="mt-8 inline-block rounded-2xl bg-sky-500 px-6 py-3 font-medium text-white transition hover:bg-sky-400"
        >
          Open Calculator
        </Link>
      </div>
    </main>
  );
}
