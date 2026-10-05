"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import type { OrderTrackingView as OrderTrackingViewModel } from "@/lib/orderTracking";

const IR_CONTACT_MAILTO =
  "mailto:investorrelations@axiskey.com?subject=Question about my order";

type LoadState = "loading" | "ready" | "not_found" | "error";

const STEP_DOT: Record<string, string> = {
  complete: "bg-axis-core text-white",
  current: "bg-axis-signal text-axis-core",
  upcoming: "bg-axis-light text-axis-core/40",
  canceled: "bg-axis-base/60 text-axis-core/50",
};

const SCENARIO_TONE: Record<string, string> = {
  pending_documents: "bg-axis-core text-white",
  pending_payment: "bg-axis-core text-white",
  processing: "bg-axis-core text-white",
  completed: "bg-axis-core text-white",
  canceled: "bg-axis-base/40 text-axis-core",
};

const SCENARIO_SUBTEXT: Record<string, string> = {
  pending_documents: "text-white/75",
  pending_payment: "text-white/75",
  processing: "text-white/75",
  completed: "text-white/75",
  canceled: "text-axis-core/65",
};

const SCENARIO_BODYTEXT: Record<string, string> = {
  pending_documents: "text-white/90",
  pending_payment: "text-white/90",
  processing: "text-white/90",
  completed: "text-white/90",
  canceled: "text-axis-core/80",
};

const SCENARIO_BUTTON: Record<string, string> = {
  pending_documents: "bg-white/10 text-white hover:bg-white/20",
  pending_payment: "bg-white/10 text-white hover:bg-white/20",
  processing: "bg-white/10 text-white hover:bg-white/20",
  completed: "bg-white/10 text-white hover:bg-white/20",
  canceled: "bg-axis-core/10 text-axis-core hover:bg-axis-core/20",
};

export function OrderTrackingView({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [view, setView] = useState<OrderTrackingViewModel | null>(null);

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
        <h1 className="text-center font-head text-[22px] font-medium text-axis-core">
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
        <h1 className="text-center font-head text-[22px] font-medium text-axis-core">
          Something went wrong
        </h1>
        <p className="mt-2 text-center text-sm text-axis-core/55">
          We couldn&rsquo;t load your order right now. Please try again in a few minutes.
        </p>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <header className="mb-8 text-center">
        <h1 className="font-head text-[24px] font-medium leading-tight tracking-tight text-axis-core">
          {view.investorName ? `Hello, ${view.investorName}.` : "Track your investment"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-axis-core/55">
          Here is the latest status of your order.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs">
        {view.dealName && <Chip label="Offering" value={view.dealName} />}
        {view.confirmedAmount !== null && (
          <Chip label="Amount" value={`$${view.confirmedAmount.toLocaleString("en-US")}`} />
        )}
        {view.investorName && <Chip label="Investor" value={view.investorName} />}
        {view.currentAccountName && <Chip label="Account" value={view.currentAccountName} />}
      </div>

      <Stepper steps={view.steps} />

      {view.scenario !== "canceled" && (
        <div className="mt-8 rounded-card border border-axis-base/40 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-axis-core">Pre-funding checklist</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {view.checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm text-axis-core/80">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.complete ? "bg-axis-signal text-axis-core" : "bg-axis-light text-axis-core/40"
                  }`}
                >
                  {item.complete ? "✓" : ""}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
          {(view.accountType || view.dealType) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-axis-base/30 pt-4 text-xs text-axis-core/55">
              {view.accountType && <span>Account type: {view.accountType}</span>}
              {view.dealType && <span>Deal type: {view.dealType}</span>}
            </div>
          )}
        </div>
      )}

      <div className={`mt-6 rounded-card px-6 py-6 ${SCENARIO_TONE[view.scenario]}`}>
        <h2 className="font-head text-lg font-medium leading-tight">{view.headline}</h2>
        <p className={`mt-2 text-sm leading-relaxed ${SCENARIO_SUBTEXT[view.scenario]}`}>{view.explanation}</p>
        <p className={`mt-4 whitespace-pre-line text-sm leading-relaxed ${SCENARIO_BODYTEXT[view.scenario]}`}>
          {view.nextStep}
        </p>
        <a
          href={IR_CONTACT_MAILTO}
          className={`mt-5 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${SCENARIO_BUTTON[view.scenario]}`}
        >
          Ask Investor Relations
        </a>
      </div>

      {view.scenario === "completed" && (
        <div className="mt-6 rounded-card border border-axis-base/40 bg-white p-5 text-center">
          <h2 className="text-sm font-bold text-axis-core">How was your investing experience?</h2>
          <p className="mt-1 text-sm text-axis-core/55">
            Your order is complete. We would love to hear your feedback.
          </p>
          <a
            href="/rate-your-experience"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-axis-signal px-5 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85"
          >
            Rate your experience
          </a>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-axis-cream px-4 py-12">
      <div className={`w-full overflow-hidden rounded-card bg-white shadow-card ${wide ? "max-w-[640px]" : "max-w-[460px]"}`}>
        <div className="h-[5px] bg-axis-signal" />
        <div className="px-6 py-10 sm:px-10">
          <div className="mb-7 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-axis-base/50 bg-axis-light px-3 py-1.5 text-axis-core/75">
      <span className="font-bold text-axis-core">{label}:</span> {value}
    </span>
  );
}

function Stepper({ steps }: { steps: OrderTrackingViewModel["steps"] }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-col items-center text-center">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${STEP_DOT[step.state]}`}
          >
            {step.state === "complete" ? "✓" : index + 1}
          </span>
          <span className="mt-2 text-[11px] leading-tight text-axis-core/60">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
