"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { PreviousTicketsPanel } from "./PreviousTicketsPanel";

type SubmitState = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-[6px] border border-axis-base/50 px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

/**
 * Internal tool, not an investor-facing request form -- an AxisKey
 * coworker fills this out on an investor's behalf (phone/email support,
 * a forwarded complaint, etc.) and submitting emails IR directly, which
 * is what creates the Zendesk ticket on AxisKey's side (an email-to-
 * ticket automation on ir@axiskey.com, outside this app). No
 * PageShell/Sidebar, no auth guard -- same convention as
 * RateYourExperienceForm.tsx, since the link is shared directly rather
 * than reached through /admin.
 *
 * The form sits next to PreviousTicketsPanel (Oct 2026), which lists
 * what's already been submitted here and its live Zendesk status --
 * refreshSignal bumps on every successful submit so a just-created
 * inquiry shows up there right away (likely still "Pending" until the
 * email-to-ticket automation and this app's own resolve step catch up).
 */
export function SupportInquiryForm() {
  const [investorName, setInvestorName] = useState("");
  const [investorEmail, setInvestorEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");

  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState("");

  async function handleExplain() {
    if (!subject.trim() && !detail.trim()) return;
    setExplaining(true);
    setExplainError("");
    try {
      const res = await fetch("/api/support-inquiry/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, detail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not generate an explanation.");
      setDetail(body.explanation);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Could not generate an explanation.");
    } finally {
      setExplaining(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/support-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorName, investorEmail, phone, subject, detail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not send this inquiry.");
      setState("success");
      setRefreshSignal((n) => n + 1);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Could not send this inquiry.");
    }
  }

  return (
    <main className="min-h-screen bg-axis-light px-6 py-12">
      <div className="mx-auto flex max-w-[940px] flex-col items-start gap-8 lg:flex-row lg:justify-center">
        <div className="w-full max-w-[520px] overflow-hidden rounded-card bg-white shadow-card">
          <div className="h-[5px] bg-axis-signal" />
          <div className="px-10 py-11">
            <div className="mb-7 flex justify-center">
              <Logo />
            </div>

            {state === "success" ? (
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-axis-signal text-2xl font-bold text-axis-core">
                  &#10003;
                </div>
                <h1 className="font-head text-[22px] font-medium leading-tight tracking-tight text-axis-core">
                  Inquiry sent
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-axis-core/55">
                  This has been emailed to IR and will come in as a support ticket.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInvestorName("");
                    setInvestorEmail("");
                    setPhone("");
                    setSubject("");
                    setDetail("");
                    setState("idle");
                  }}
                  className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-axis-core px-4 py-[15px] text-sm font-bold text-white transition-colors hover:bg-axis-core/90"
                >
                  Submit another inquiry
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-center font-head text-[22px] font-medium leading-tight tracking-tight text-axis-core">
                  Support Inquiry
                </h1>
                <p className="mt-2 mb-7 text-center text-sm leading-relaxed text-axis-core/55">
                  Report an investor issue directly to IR. For internal use.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                      Investor name <span className="text-red-600">*</span>
                    </span>
                    <input
                      required
                      value={investorName}
                      onChange={(e) => setInvestorName(e.target.value)}
                      placeholder="Michael Dawson"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                      Investor email <span className="text-red-600">*</span>
                    </span>
                    <input
                      required
                      type="email"
                      value={investorEmail}
                      onChange={(e) => setInvestorEmail(e.target.value)}
                      placeholder="michael.dawson@email.com"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Phone (optional)</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(305) 555-0123"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                      Subject <span className="text-red-600">*</span>
                    </span>
                    <input
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Can't find my distributions"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-axis-core/80">
                        Detail <span className="text-red-600">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleExplain}
                        disabled={explaining || (!subject.trim() && !detail.trim())}
                        className="shrink-0 rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-40"
                      >
                        {explaining ? "Generating..." : "Generate AI Explanation"}
                      </button>
                    </div>
                    <textarea
                      required
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      rows={5}
                      placeholder="What's the problem?"
                      className={inputClass}
                    />
                    {explainError && <p className="mt-1.5 text-xs text-red-700">{explainError}</p>}
                  </label>

                  {state === "error" && (
                    <p className="rounded-[6px] bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={state === "submitting"}
                    className="w-full rounded-full bg-axis-signal py-[15px] text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {state === "submitting" ? "Sending..." : "Submit Inquiry"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <PreviousTicketsPanel refreshSignal={refreshSignal} />
      </div>
    </main>
  );
}
