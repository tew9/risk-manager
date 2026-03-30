import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import * as React from "react";

type Pair = "EUR/USD" | "GBP/USD" | "USD/CAD" | "AUD/USD";

type LoaderData = {
  rates: Record<Pair, number>;
  fetchedAt: string;
  apiDate: string | null;
  sourceLabel: string;
};

type CalculationResult = {
  monthlyMaxLoss: number;
  weeklyMaxLoss: number;
  tradeRiskCap: number;
  remainingMonthlyLossRoom: number;
  remainingWeeklyLossRoom: number;
  allowedRisk: number;
  pipValuePerStandardLotUsd: number;
  marginPerStandardLotUsd: number;
  rawLotsByRisk: number;
  maxLotsByMargin: number;
  finalLots: number;
  finalUnits: number;
  notionalUsd: number;
  riskBlockedReason: string | null;
};

const LOT_UNITS = 100_000;
const MONTHLY_DRAWDOWN_PCT = 0.06;
const WEEKLY_DRAWDOWN_PCT = 0.02;
const TRADE_RISK_OF_WEEKLY_DD = 0.10;

const PAIRS: Pair[] = ["EUR/USD", "GBP/USD", "USD/CAD", "AUD/USD"];

export const meta: MetaFunction = () => {
  return [
    { title: "Forex Size Calculator | Remix" },
    {
      name: "description",
      content:
        "A beautiful forex position size calculator with monthly, weekly, and per-trade risk enforcement.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 7_000);

  try {
    const url = new URL("https://api.frankfurter.dev/v2/rates");
    url.searchParams.set("base", "USD");
    url.searchParams.set("quotes", "EUR,GBP,CAD,AUD");

    const response = await fetch(url.toString(), {
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Remix-Forex-Size-Calculator",
      },
    });

    if (!response.ok) {
      throw new Error(`Rate request failed with ${response.status}`);
    }

    const payload = (await response.json()) as Array<{
      base: string;
      quote: string;
      rate: number;
      date: string;
    }>;

    const quoteMap = new Map<string, number>();
    let apiDate: string | null = null;

    for (const item of payload) {
      quoteMap.set(item.quote, item.rate);
      apiDate = item.date;
    }

    const eurUsd = invertRate(quoteMap.get("EUR"));
    const gbpUsd = invertRate(quoteMap.get("GBP"));
    const usdCad = directRate(quoteMap.get("CAD"));
    const audUsd = invertRate(quoteMap.get("AUD"));

    const data: LoaderData = {
      rates: {
        "EUR/USD": eurUsd,
        "GBP/USD": gbpUsd,
        "USD/CAD": usdCad,
        "AUD/USD": audUsd,
      },
      fetchedAt: new Date().toISOString(),
      apiDate,
      sourceLabel: "Frankfurter / institutional daily FX references",
    };

    return json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    const fallback: LoaderData = {
      rates: {
        "EUR/USD": 1.08,
        "GBP/USD": 1.29,
        "USD/CAD": 1.36,
        "AUD/USD": 0.65,
      },
      fetchedAt: new Date().toISOString(),
      apiDate: null,
      sourceLabel: "Fallback rates",
    };

    return json(fallback);
  } finally {
    clearTimeout(timeout);
  }
}

function directRate(rate?: number) {
  if (!rate || rate <= 0) return 0;
  return rate;
}

function invertRate(rate?: number) {
  if (!rate || rate <= 0) return 0;
  return 1 / rate;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function decimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function integer(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function pipValuePerStandardLotUsd(pair: Pair, rate: number) {
  if (pair === "USD/CAD") {
    if (!rate) return 0;
    return (0.0001 * LOT_UNITS) / rate;
  }

  return 0.0001 * LOT_UNITS;
}

function notionalUsdPerStandardLot(pair: Pair, rate: number) {
  switch (pair) {
    case "EUR/USD":
    case "GBP/USD":
    case "AUD/USD":
      return LOT_UNITS * rate;
    case "USD/CAD":
      return LOT_UNITS;
    default:
      return LOT_UNITS;
  }
}

/**
 * Core risk engine:
 *
 * Hard cap per trade = balance × 6% × (2%/6%) × 10% = 0.2% of balance.
 *
 * Then further clamped by:
 *   - remaining monthly drawdown room  (6% cap − month losses so far)
 *   - remaining weekly  drawdown room  (2% cap − week  losses so far)
 *
 * Final allowed risk = min(tradeRiskCap, monthRoom, weekRoom)
 * Lot size           = allowedRisk / (stopPips × pipValue)
 * Then capped again by available margin.
 */
function calculatePosition(params: {
  balance: number;
  stopLossPips: number;
  leverage: number;
  pair: Pair;
  rate: number;
  currentWeekLoss: number;
  currentMonthLoss: number;
}): CalculationResult {
  const {
    balance,
    stopLossPips,
    leverage,
    pair,
    rate,
    currentWeekLoss,
    currentMonthLoss,
  } = params;

  const monthlyMaxLoss = balance * MONTHLY_DRAWDOWN_PCT;
  const weeklyMaxLoss = balance * WEEKLY_DRAWDOWN_PCT;
  const tradeRiskCap = weeklyMaxLoss * TRADE_RISK_OF_WEEKLY_DD;

  const remainingMonthlyLossRoom = Math.max(monthlyMaxLoss - currentMonthLoss, 0);
  const remainingWeeklyLossRoom = Math.max(weeklyMaxLoss - currentWeekLoss, 0);
  const allowedRisk = Math.max(
    Math.min(tradeRiskCap, remainingMonthlyLossRoom, remainingWeeklyLossRoom),
    0,
  );

  const pipValue = pipValuePerStandardLotUsd(pair, rate);
  const marginPerStandardLotUsd =
    leverage > 0 ? notionalUsdPerStandardLot(pair, rate) / leverage : 0;

  const rawLotsByRisk =
    pipValue > 0 && stopLossPips > 0 ? allowedRisk / (stopLossPips * pipValue) : 0;

  const maxLotsByMargin =
    marginPerStandardLotUsd > 0 ? balance / marginPerStandardLotUsd : 0;

  const finalLots = Math.max(Math.min(rawLotsByRisk, maxLotsByMargin), 0);
  const finalUnits = Math.floor(finalLots * LOT_UNITS);
  const notionalUsd = finalLots * notionalUsdPerStandardLot(pair, rate);

  let riskBlockedReason: string | null = null;
  if (remainingWeeklyLossRoom <= 0) {
    riskBlockedReason = "Weekly drawdown limit already reached.";
  } else if (remainingMonthlyLossRoom <= 0) {
    riskBlockedReason = "Monthly drawdown limit already reached.";
  } else if (maxLotsByMargin <= 0 || finalLots <= 0) {
    riskBlockedReason = "Not enough room for this stop size under current limits.";
  }

  return {
    monthlyMaxLoss,
    weeklyMaxLoss,
    tradeRiskCap,
    remainingMonthlyLossRoom,
    remainingWeeklyLossRoom,
    allowedRisk,
    pipValuePerStandardLotUsd: pipValue,
    marginPerStandardLotUsd,
    rawLotsByRisk,
    maxLotsByMargin,
    finalLots,
    finalUnits,
    notionalUsd,
    riskBlockedReason,
  };
}

export default function ForexSizeCalculatorRoute() {
  const data = useLoaderData<typeof loader>();

  const [pair, setPair] = React.useState<Pair>("EUR/USD");
  const [balance, setBalance] = React.useState<number>(6000);
  const [stopLossPips, setStopLossPips] = React.useState<number>(25);
  const [leverage, setLeverage] = React.useState<number>(30);
  const [currentWeekLoss, setCurrentWeekLoss] = React.useState<number>(0);
  const [currentMonthLoss, setCurrentMonthLoss] = React.useState<number>(0);

  const currentRate = data.rates[pair];

  const result = React.useMemo(
    () =>
      calculatePosition({
        balance,
        stopLossPips,
        leverage,
        pair,
        rate: currentRate,
        currentWeekLoss,
        currentMonthLoss,
      }),
    [balance, stopLossPips, leverage, pair, currentRate, currentWeekLoss, currentMonthLoss],
  );

  const riskPctOfBalance = balance > 0 ? (result.allowedRisk / balance) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Hero / inputs ───────────────────────────────────── */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left – description + metric cards */}
            <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Forex risk engine
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  USD account
                </span>
              </div>

              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Beautiful position sizing that protects your weekly and monthly drawdown.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Built around your rules: 6&nbsp;% monthly max drawdown, 2&nbsp;% weekly max
                drawdown, and 10&nbsp;% of weekly drawdown as the absolute per-trade risk
                cap&nbsp;&mdash; effectively <strong>0.2&nbsp;%</strong> of balance before any
                existing losses erode the room further.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Monthly max loss"
                  value={currency(result.monthlyMaxLoss)}
                  sublabel="6% of balance"
                />
                <MetricCard
                  label="Weekly max loss"
                  value={currency(result.weeklyMaxLoss)}
                  sublabel="2% of balance"
                />
                <MetricCard
                  label="Trade risk cap"
                  value={currency(result.tradeRiskCap)}
                  sublabel="10% of weekly max"
                />
              </div>
            </div>

            {/* Right – inputs */}
            <div className="p-6 lg:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account balance (USD)">
                  <input
                    value={Number.isNaN(balance) ? "" : balance}
                    onChange={(e) => setBalance(Number(e.target.value || 0))}
                    inputMode="decimal"
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Pair">
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value as Pair)}
                    className={inputClassName}
                  >
                    {PAIRS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Stop loss (pips)">
                  <input
                    value={Number.isNaN(stopLossPips) ? "" : stopLossPips}
                    onChange={(e) => setStopLossPips(Number(e.target.value || 0))}
                    inputMode="decimal"
                    type="number"
                    min={0}
                    step="0.1"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Leverage">
                  <input
                    value={Number.isNaN(leverage) ? "" : leverage}
                    onChange={(e) => setLeverage(Number(e.target.value || 0))}
                    inputMode="decimal"
                    type="number"
                    min={1}
                    step="1"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Current week realized loss (USD)">
                  <input
                    value={Number.isNaN(currentWeekLoss) ? "" : currentWeekLoss}
                    onChange={(e) => setCurrentWeekLoss(Number(e.target.value || 0))}
                    inputMode="decimal"
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Current month realized loss (USD)">
                  <input
                    value={Number.isNaN(currentMonthLoss) ? "" : currentMonthLoss}
                    onChange={(e) => setCurrentMonthLoss(Number(e.target.value || 0))}
                    inputMode="decimal"
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
                Live reference for <span className="font-semibold">{pair}</span>:{" "}
                {decimal(currentRate, 5)}
                <span className="mx-2 text-sky-300">&bull;</span>
                Source: {data.sourceLabel}
                {data.apiDate ? (
                  <>
                    <span className="mx-2 text-sky-300">&bull;</span>
                    Rate date: {data.apiDate}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ── Results ─────────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left – sizing output */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-300">Recommended size</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {decimal(result.finalLots, 3)} lots
                </h2>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Units</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-100">
                  {integer(result.finalUnits)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ResultRow label="Allowed risk for this trade" value={currency(result.allowedRisk)} />
              <ResultRow label="Risk as % of balance" value={`${decimal(riskPctOfBalance, 3)}%`} />
              <ResultRow
                label="Pip value per 1.00 lot"
                value={`${currency(result.pipValuePerStandardLotUsd)} / pip`}
              />
              <ResultRow
                label="Margin per 1.00 lot"
                value={currency(result.marginPerStandardLotUsd)}
              />
              <ResultRow
                label="Raw size from risk"
                value={`${decimal(result.rawLotsByRisk, 3)} lots`}
              />
              <ResultRow
                label="Max size from margin"
                value={`${decimal(result.maxLotsByMargin, 3)} lots`}
              />
              <ResultRow label="Estimated notional exposure" value={currency(result.notionalUsd)} />
              <ResultRow label="Equivalent units" value={integer(result.finalUnits)} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p>
                The calculator takes the smallest of: remaining monthly loss room, remaining
                weekly loss room, and your fixed per-trade cap.
              </p>
              {result.riskBlockedReason ? (
                <p className="mt-3 font-medium text-rose-300">{result.riskBlockedReason}</p>
              ) : (
                <p className="mt-3 font-medium text-emerald-300">
                  Trade size is within both drawdown and estimated margin limits.
                </p>
              )}
            </div>
          </div>

          {/* Right – risk breakdown */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur lg:p-8">
            <h3 className="text-xl font-semibold tracking-tight text-white">Risk breakdown</h3>

            <div className="mt-6 space-y-5">
              <ProgressBlock
                label="Weekly loss room left"
                current={result.remainingWeeklyLossRoom}
                max={result.weeklyMaxLoss}
                tone="blue"
              />
              <ProgressBlock
                label="Monthly loss room left"
                current={result.remainingMonthlyLossRoom}
                max={result.monthlyMaxLoss}
                tone="violet"
              />
              <ProgressBlock
                label="Per-trade risk used"
                current={result.allowedRisk}
                max={result.tradeRiskCap || 1}
                tone="emerald"
              />
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-sm font-medium text-slate-300">Sizing formula</p>
              <code className="mt-3 block overflow-x-auto text-sm leading-7 text-slate-100">
                lots = allowedRisk / (stopLossPips &times; pipValuePerStandardLot)
              </code>
              <code className="mt-3 block overflow-x-auto text-sm leading-7 text-slate-100">
                units = lots &times; 100,000
              </code>
              <code className="mt-3 block overflow-x-auto text-sm leading-7 text-slate-100">
                finalLots = min(rawLotsByRisk, maxLotsByMargin)
              </code>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ── Small components ────────────────────────────────────────── */

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">{props.label}</span>
      {props.children}
    </label>
  );
}

function MetricCard(props: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-sm text-slate-400">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{props.value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">{props.sublabel}</p>
    </div>
  );
}

function ResultRow(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-sm text-slate-400">{props.label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{props.value}</p>
    </div>
  );
}

function ProgressBlock(props: {
  label: string;
  current: number;
  max: number;
  tone: "blue" | "violet" | "emerald";
}) {
  const percent = props.max > 0 ? Math.min((props.current / props.max) * 100, 100) : 0;

  const toneClass = {
    blue: "bg-sky-400",
    violet: "bg-violet-400",
    emerald: "bg-emerald-400",
  }[props.tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{props.label}</p>
        <p className="text-sm font-medium text-white">
          {currency(props.current)} / {currency(props.max)}
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${toneClass} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20";
