"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import type { OrderTrackingView as OrderTrackingViewModel } from "@/lib/orderTracking";

const PORTAL_URL = "https://app.axiskey.com/";
const IR_CONTACT_EMAIL = "ir@axiskey.com";
const IR_CONTACT_MAILTO = `mailto:${IR_CONTACT_EMAIL}?subject=Question about my order`;

type LoadState = "loading" | "ready" | "not_found" | "error";

const STEP_DOT: Record<string, string> = {
  complete: "bg-axis-signal text-axis-core",
  current: "bg-axis-light text-axis-core/60 border border-axis-base",
  upcoming: "bg-axis-light text-axis-core/60 border border-axis-base",
  canceled: "bg-axis-base text-axis-core/50",
};

const STEP_CAPTION: Record<string, string> = {
  complete: "Complete",
  current: "In progress",
  upcoming: "Not started",
  canceled: "Canceled",
};

const PANEL_TONE: Record<string, string> = {
  pending_documents: "bg-axis-core text-white",
  pending_payment: "bg-axis-core text-white",
  processing: "bg-axis-core text-white",
  completed: "bg-axis-core text-white",
  canceled: "bg-axis-base/40 text-axis-core",
};

const PANEL_MUTED: Record<string, string> = {
  pending_documents: "text-white/50",
  pending_payment: "text-white/50",
  processing: "text-white/50",
  completed: "text-white/50",
  canceled: "text-axis-core/50",
};

const PANEL_BORDER: Record<string, string> = {
  pending_documents: "border-white/15",
  pending_payment: "border-white/15",
  processing: "border-white/15",
  completed: "border-white/15",
  canceled: "border-axis-core/15",
};

const PANEL_LINK: Record<string, string> = {
  pending_documents: "text-white/70 hover:text-white",
  pending_payment: "text-white/70 hover:text-white",
  processing: "text-white/70 hover:text-white",
  completed: "text-white/70 hover:text-white",
  canceled: "text-axis-core/70 hover:text-axis-core",
};

export function OrderTrackingView({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [view, setView] = useState<OrderTrackingViewModel | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/order-tracking/${token}`);
        if (cancelled) return;

        if (response.status === 404) {
          setState("not_found");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }

        const data = (await response.json()) as OrderTrackingViewModel;
        setView(data);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (state === "loading") {
    return (
      <Shell>
        <p className="text-center text-sm text-axis-core/55">Loading your order...</p>
      </Shell>
    );
  }

  if (state === "not_found") {
    return (
      <Shell>
        <h1 className="text-center font-head text-xl font-medium text-axis-core">
          We couldn&rsquo;t find this tracking link
        </h1>
        <p className="mt-2 text-center text-sm text-axis-core/55">
          This link may have expired or been entered incorrectly. Please contact your Investor
          Relations representative for help.
        </p>
      </Shell>
    );
  }

  if (state === "error" || !view) {
    return (
      <Shell>
        <h1 className="text-center font-head text-xl font-medium text-axis-core">
          Something went wrong
        </h1>
        <p className="mt-2 text-center text-sm text-axis-core/55">
          We couldn&rsquo;t load your order right now. Please try again in a few minutes.
        </p>
      </Shell>
    );
  }

  const tone = PANEL_TONE[view.scenario];
  const muted = PANEL_MUTED[view.scenario];
  const border = PANEL_BORDER[view.scenario];
  const link = PANEL_LINK[view.scenario];

  return (
    <div className="flex min-h-screen flex-col bg-axis-cream">
      <header className="flex shrink-0 items-center justify-between bg-axis-core px-6 py-3.5">
        <Logo variant="light" />
        <span className="hidden text-xs text-white/40 sm:inline">Order tracking</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-5">
        <div className="w-full max-w-5xl rounded-card bg-white p-6 shadow-card sm:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              {view.investorName && (
                <p className="text-sm text-axis-core/55">Hello, {view.investorName}.</p>
              )}
              <h1 className="font-head text-2xl font-bold leading-tight text-axis-core sm:text-[28px]">
                Track your <span className="bg-axis-signal px-1.5">investment</span>.
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view.dealName && <Chip>{view.dealName}</Chip>}
              {view.confirmedAmount !== null && (
                <ChipHighlight>
                  Confirmed amount: ${view.confirmedAmount.toLocaleString("en-US")}
                </ChipHighlight>
              )}
              <button
                type="button"
                onClick={copyLink}
                className="rounded-full border border-axis-base/60 px-3.5 py-1.5 text-xs font-bold text-axis-core transition-colors hover:bg-axis-light"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-xl bg-axis-light/60 px-4 py-5 sm:px-8">
            <Stepper steps={view.steps} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div className={`rounded-xl p-5 ${tone}`}>
              <h2 className="font-head text-lg font-medium leading-tight">{view.headline}.</h2>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {view.scenario !== "canceled" && (
                  <a
                    href={PORTAL_URL}
                    className="inline-flex items-center justify-center rounded-full bg-axis-signal px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85"
                  >
                    Go to AxisKey portal
                  </a>
                )}
                {view.scenario === "completed" && (
                  <a
                    href="/rate-your-experience"
                    className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold transition-colors hover:bg-white/20"
                  >
                    Rate your experience
                  </a>
                )}
                {view.scenario === "canceled" && (
                  <a
                    href={IR_CONTACT_MAILTO}
                    className="inline-flex items-center justify-center rounded-full bg-axis-core/10 px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-core/20"
                  >
                    Ask Investor Relations
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                className={`mt-3.5 flex items-center gap-1 text-xs font-semibold ${link}`}
              >
                More details
                <svg
                  className={`h-2.5 w-2.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 12 8"
                  fill="none"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {detailsOpen && (
                <div className={`mt-3 grid grid-cols-1 gap-3 border-t pt-3.5 text-xs sm:grid-cols-2 ${border}`}>
                  {view.currentAccountName && (
                    <div>
                      <p className={`mb-0.5 uppercase tracking-wide ${muted}`}>Current account</p>
                      <p>{view.currentAccountName}</p>
                    </div>
                  )}
                  <div>
                    <p className={`mb-0.5 uppercase tracking-wide ${muted}`}>Next step</p>
                    <p>{view.nextStep}</p>
                  </div>
                  <div className="sm:col-span-2">
                    Ask about this order:{" "}
                    <a href={IR_CONTACT_MAILTO} className="underline">
                      {IR_CONTACT_EMAIL}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-axis-base/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-axis-core">Pre-funding checks</h2>
                {view.accountType && (
                  <span className="rounded-full bg-axis-light px-2.5 py-1 text-[11px] font-semibold text-axis-core/70">
                    {view.accountType}
                  </span>
                )}
              </div>

              {view.scenario === "canceled" ? (
                <p className="text-sm text-axis-core/55">
                  This order was canceled before compliance checks were finalized.
                </p>
              ) : (
                <ul className="divide-y divide-axis-base/20 text-sm">
                  {view.checklist.map((item) => (
                    <li key={item.label} className="flex items-center justify-between py-2">
                      <span className="text-axis-core/80">{item.label}</span>
                      <StatusPill complete={item.complete} />
                    </li>
                  ))}
                </ul>
              )}

              {view.docsNeeded && (
                <div className="mt-2 border-t border-axis-base/20 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setDocsOpen((open) => !open)}
                    className="text-xs font-semibold text-axis-core/60 underline underline-offset-2 hover:text-axis-core"
                  >
                    View requirements for this account
                  </button>
                  {docsOpen && (
                    <p className="mt-2 text-xs leading-relaxed text-axis-core/65">{view.docsNeeded}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-axis-cream px-4 py-12">
      <div className="w-full max-w-[460px] overflow-hidden rounded-card bg-white shadow-card">
        <div className="h-[5px] bg-axis-signal" />
        <div className="px-8 py-10">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-axis-base/50 bg-axis-light px-3 py-1.5 text-xs font-semibold text-axis-core/75">
      {children}
    </span>
  );
}

function ChipHighlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-axis-signal px-3 py-1.5 text-xs font-bold text-axis-core">{children}</span>
  );
}

function StatusPill({ complete }: { complete: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        complete ? "bg-axis-signal/30 text-axis-core" : "bg-axis-light text-axis-core/45"
      }`}
    >
      {complete ? "Complete" : "Pending"}
    </span>
  );
}

function Stepper({ steps }: { steps: OrderTrackingViewModel["steps"] }) {
  const isCanceled = steps.some((step) => step.state === "canceled");
  const completedCount = steps.filter((step) => step.state === "complete").length;
  const gaps = Math.max(steps.length - 1, 1);
  const progressRatio = Math.min(completedCount / gaps, 1);

  // Each <li> below is an equal-width column (flex-1), so a dot's center
  // sits at exact, predictable percentages regardless of label text
  // length -- the first/last dot centers are at half a column's width in
  // from each edge, not a guessed fixed percentage (that guess is what
  // caused the line to visibly stop short of the first/last dot before).
  const edgeOffsetPercent = 50 / steps.length;

  return (
    <div className="relative">
      <div
        className="absolute top-[15px] h-[3px] rounded-full bg-axis-base/40"
        style={{ left: `${edgeOffsetPercent}%`, right: `${edgeOffsetPercent}%` }}
      />
      {!isCanceled && progressRatio > 0 && (
        <div
          className="absolute top-[15px] h-[3px] rounded-full bg-axis-signal"
          style={{
            left: `${edgeOffsetPercent}%`,
            width: `calc((100% - ${edgeOffsetPercent * 2}%) * ${progressRatio})`,
          }}
        />
      )}
      <ol className="relative flex">
        {steps.map((step, index) => (
          <li key={step.label} className="flex flex-1 flex-col items-center gap-1.5 px-1.5 text-center">
            <span
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold ${STEP_DOT[step.state]}`}
            >
              {step.state === "complete" ? "✓" : index + 1}
            </span>
            <span className="max-w-[90px] text-[11px] font-semibold leading-tight text-axis-core sm:max-w-none sm:text-xs">
              {step.label}
            </span>
            <span className="text-[10px] text-axis-core/45">{STEP_CAPTION[step.state]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
