"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import type { OrderTrackingView as OrderTrackingViewModel } from "@/lib/orderTracking";
import { ACCOUNT_REQUIREMENTS, DOCUMENT_UPLOAD_GUIDE_URL } from "@/lib/orderTracking/accountRequirements";

const PORTAL_URL = "https://app.axiskey.com/";
const IR_CONTACT_EMAIL = "ir@axiskey.com";
const IR_CONTACT_MAILTO = `mailto:${IR_CONTACT_EMAIL}?subject=Question about my order`;

type LoadState = "loading" | "ready" | "not_found" | "error";

const STEP_DOT: Record<string, string> = {
  complete: "bg-axis-signal text-axis-core",
  current: "bg-axis-light text-axis-core/60 border border-axis-base",
  processing: "bg-axis-light text-axis-core/60 border border-axis-base",
  upcoming: "bg-axis-light text-axis-core/60 border border-axis-base",
  canceled: "bg-axis-base text-axis-core/50",
};

const STEP_CAPTION: Record<string, string> = {
  complete: "Complete",
  current: "In progress",
  processing: "Processing",
  upcoming: "Not started",
  canceled: "Canceled",
};

// Every non-canceled scenario shares one tan panel (bg-axis-base, per the
// brand guide) with dark text -- previously bg-axis-core (near-black)
// with white text.
const PANEL_TONE: Record<string, string> = {
  pending_documents: "bg-axis-base text-axis-core",
  pending_payment: "bg-axis-base text-axis-core",
  processing: "bg-axis-base text-axis-core",
  completed: "bg-axis-base text-axis-core",
  canceled: "bg-axis-base/40 text-axis-core",
};

const PANEL_MUTED: Record<string, string> = {
  pending_documents: "text-axis-core/50",
  pending_payment: "text-axis-core/50",
  processing: "text-axis-core/50",
  completed: "text-axis-core/50",
  canceled: "text-axis-core/50",
};

const PANEL_BORDER: Record<string, string> = {
  pending_documents: "border-axis-core/15",
  pending_payment: "border-axis-core/15",
  processing: "border-axis-core/15",
  completed: "border-axis-core/15",
  canceled: "border-axis-core/15",
};

const PANEL_LINK: Record<string, string> = {
  pending_documents: "text-axis-core/70 hover:text-axis-core",
  pending_payment: "text-axis-core/70 hover:text-axis-core",
  processing: "text-axis-core/70 hover:text-axis-core",
  completed: "text-axis-core/70 hover:text-axis-core",
  canceled: "text-axis-core/70 hover:text-axis-core",
};

export function OrderTrackingView({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [view, setView] = useState<OrderTrackingViewModel | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
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
      <header className="flex shrink-0 items-center justify-between bg-axis-base px-6 py-3.5">
        <Logo />
        <span className="hidden text-xs text-axis-core/50 sm:inline">Order tracking</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-5">
        <div className="w-full max-w-5xl rounded-card bg-white p-6 shadow-card sm:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              {view.investorName && (
                <p className="text-sm text-axis-core/55">Hello, {view.investorName}.</p>
              )}
              <h1 className="font-head text-2xl font-bold leading-tight text-axis-core sm:text-[28px]">
                Track your <span className="bg-axis-signal px-1.5">investment</span>
                {view.dealName && <> on {view.dealName}</>}.
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Order ID: {view.orderName}</Chip>
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

          {view.scenario === "completed" ? (
            <div className="mb-5 flex items-center justify-center gap-2.5 rounded-xl bg-axis-light/60 px-4 py-5 sm:px-8">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-axis-signal text-xs font-bold text-axis-core">
                ✓
              </span>
              <span className="font-head text-base font-bold text-axis-core">Order complete</span>
            </div>
          ) : (
            <div className="mb-5 rounded-xl bg-axis-light/60 px-4 py-5 sm:px-8">
              <Stepper steps={view.steps} />
            </div>
          )}

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
                {view.scenario === "pending_documents" && (
                  <>
                    <a
                      href={DOCUMENT_UPLOAD_GUIDE_URL}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center justify-center rounded-full border border-axis-core/30 px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-core/10"
                    >
                      How to upload KYC documents
                    </a>
                    {view.accountType && ACCOUNT_REQUIREMENTS[view.accountType] && (
                      <button
                        type="button"
                        onClick={() => setRequirementsOpen(true)}
                        className="inline-flex items-center justify-center rounded-full border border-axis-core/30 px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-core/10"
                      >
                        View accepted KYC documents
                      </button>
                    )}
                  </>
                )}
                {view.scenario === "completed" && (
                  <a
                    href="/rate-your-experience"
                    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-axis-core shadow-sm transition-all duration-150 hover:scale-105 hover:shadow-md"
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
                      <StatusPill complete={item.complete} waived={item.waived} />
                    </li>
                  ))}
                </ul>
              )}

              {view.accountType && ACCOUNT_REQUIREMENTS[view.accountType] && (
                <div className="mt-2 border-t border-axis-base/20 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setRequirementsOpen(true)}
                    className="text-xs font-semibold text-axis-core/60 underline underline-offset-2 hover:text-axis-core"
                  >
                    View requirements for this account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {requirementsOpen && view.accountType && ACCOUNT_REQUIREMENTS[view.accountType] && (
        <RequirementsModal
          accountType={view.accountType}
          docsNeeded={view.docsNeeded}
          onClose={() => setRequirementsOpen(false)}
        />
      )}
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

function StatusPill({ complete, waived }: { complete: boolean; waived: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        complete || waived ? "bg-axis-signal/30 text-axis-core" : "bg-axis-light text-axis-core/45"
      }`}
    >
      {complete ? "Complete" : waived ? "Waived" : "Pending"}
    </span>
  );
}

function RequirementsModal({
  accountType,
  docsNeeded,
  onClose,
}: {
  accountType: string;
  docsNeeded: string | null;
  onClose: () => void;
}) {
  const requirement = ACCOUNT_REQUIREMENTS[accountType];
  if (!requirement) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-axis-core/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-card bg-white p-6 shadow-modal">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="font-head text-lg font-bold leading-tight text-axis-core">
            Requirements for {accountType}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-axis-core/40 transition-colors hover:text-axis-core"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mb-2 text-sm text-axis-core/60">
          To verify your account, provide the documents below. Select an item to see what is accepted.
        </p>
        <span className="mb-4 inline-block rounded-full bg-axis-light px-2.5 py-1 text-[11px] font-semibold text-axis-core/70">
          {requirement.count}
        </span>

        <div className="flex flex-col gap-2.5">
          {requirement.documents.map((doc, index) => (
            <details key={doc.title} className="group rounded-[6px] border border-axis-base/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-axis-light text-xs font-bold text-axis-core">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-axis-core">{doc.title}</span>
                <span className="rounded-full bg-axis-light px-2 py-0.5 text-[10px] font-bold uppercase text-axis-core/60">
                  Required
                </span>
                <svg
                  className="h-2.5 w-2.5 shrink-0 text-axis-core/40 transition-transform group-open:rotate-180"
                  viewBox="0 0 12 8"
                  fill="none"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="border-t border-axis-base/30 px-4 py-3 text-xs text-axis-core/70">
                <p className="mb-2 leading-relaxed">{doc.description}</p>
                {(doc.accepted || doc.notAccepted) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {doc.accepted && (
                      <div>
                        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-axis-core/50">
                          Accepted
                        </h4>
                        <ul className="space-y-1">
                          {doc.accepted.map((item) => (
                            <li key={item} className="flex gap-1.5">
                              <span className="text-axis-core">&#10003;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {doc.notAccepted && (
                      <div>
                        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-axis-core/50">
                          Not accepted
                        </h4>
                        <ul className="space-y-1">
                          {doc.notAccepted.map((item) => (
                            <li key={item} className="flex gap-1.5 text-red-700/75">
                              <span>&times;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {doc.options && (
                  <div className="mt-2.5">
                    <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-axis-core/50">
                      You can provide one of these
                    </h4>
                    <ul className="space-y-1">
                      {doc.options.map((item) => (
                        <li key={item} className="flex gap-1.5">
                          <span className="text-axis-core">&#10003;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {doc.includes && (
                  <div className="mt-2.5">
                    <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-axis-core/50">
                      Your document must show
                    </h4>
                    <ul className="space-y-1">
                      {doc.includes.map((item) => (
                        <li key={item} className="flex gap-1.5">
                          <span className="text-axis-core">&#10003;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>

        {requirement.notice && (
          <div className="mt-4 rounded-[6px] bg-axis-light px-3.5 py-3 text-xs leading-relaxed text-axis-core/70">
            {requirement.notice}
          </div>
        )}

        {docsNeeded && (
          <div className="mt-4 rounded-[6px] border border-axis-base/40 px-3.5 py-3 text-xs leading-relaxed text-axis-core/70">
            <span className="font-bold text-axis-core">Note from AxisKey: </span>
            {docsNeeded}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <a
            href={PORTAL_URL}
            className="inline-flex items-center justify-center rounded-full bg-axis-signal px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85"
          >
            Open AxisKey portal
          </a>
          <a
            href={DOCUMENT_UPLOAD_GUIDE_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center rounded-full border border-axis-base/60 px-4 py-2.5 text-sm font-bold text-axis-core transition-colors hover:bg-axis-light"
          >
            How to upload KYC documents
          </a>
        </div>
      </div>
    </div>
  );
}

function Stepper({ steps }: { steps: OrderTrackingViewModel["steps"] }) {
  const isCanceled = steps.some((step) => step.state === "canceled");

  // Each <li> below is an equal-width column (flex-1), so a dot's center
  // sits at exact, predictable percentages regardless of label text
  // length -- the first/last dot centers are at half a column's width in
  // from each edge, not a guessed fixed percentage (that guess is what
  // caused the line to visibly stop short of the first/last dot before).
  const colWidth = 100 / steps.length;
  const edgeOffsetPercent = colWidth / 2;

  // The steps aren't guaranteed to complete in left-to-right order (e.g.
  // payment can land before documentation does), so the connecting line
  // is colored per segment -- the segment right after a completed step
  // lights up, instead of one single left-to-right "progress so far" fill
  // that would misrepresent an out-of-order completion.
  const litSegments = isCanceled
    ? []
    : steps.slice(0, -1).map((step) => step.state === "complete");

  return (
    <div className="relative">
      <div
        className="absolute top-[15px] h-[3px] rounded-full bg-axis-base/40"
        style={{ left: `${edgeOffsetPercent}%`, right: `${edgeOffsetPercent}%` }}
      />
      {litSegments.map(
        (lit, index) =>
          lit && (
            <div
              key={index}
              className="absolute top-[15px] h-[3px] rounded-full bg-axis-signal"
              style={{ left: `${edgeOffsetPercent + index * colWidth}%`, width: `${colWidth}%` }}
            />
          )
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
