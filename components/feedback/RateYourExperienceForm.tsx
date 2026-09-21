"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

const PORTAL_URL = "https://app.axiskey.com/";

type SubmitState = "idle" | "submitting" | "success" | "error";

/**
 * Standalone, unauthenticated rating widget linked from transactional
 * emails (e.g. "Allocation Confirmed"). Deliberately has no relation to
 * the rest of the Operations Hub UI: no PageShell/Sidebar, no nav links
 * out, nothing but the logo, the rating, and the submit action, matching
 * the reference AxisKey_Rate_Your_Experience_Landing.html design.
 */
export function RateYourExperienceForm() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = Number.parseInt(params.get("stars") ?? "", 10);
    if (fromUrl >= 1 && fromUrl <= 5) setRating(fromUrl);
  }, []);

  async function handleSubmit() {
    if (rating === 0) return;
    setState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/investor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          source: "allocation_confirmed_email",
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong submitting your feedback.");
      }

      setState("success");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-axis-light px-6 py-12">
      <div className="w-full max-w-[460px] overflow-hidden rounded-card bg-white shadow-card">
        <div className="h-[5px] bg-axis-signal" />

        <div className="px-10 py-11 text-center">
          <div className="mb-7 flex justify-center">
            <Logo />
          </div>

          {state === "success" ? (
            <>
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-axis-signal text-2xl font-bold text-axis-core">
                &#10003;
              </div>
              <h1 className="font-head text-[22px] font-medium leading-tight tracking-tight text-axis-core">
                Thanks for your feedback!
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-axis-core/55">
                We&rsquo;ve shared your rating with our team. It genuinely helps us improve the
                AxisKey investor experience.
              </p>
              <a
                href={PORTAL_URL}
                className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-axis-core px-4 py-[15px] text-sm font-bold text-white transition-colors hover:bg-axis-core/90"
              >
                Log in to your portal
              </a>
            </>
          ) : (
            <>
              <h1 className="font-head text-[22px] font-medium leading-tight tracking-tight text-axis-core">
                How was your investing experience?
              </h1>
              <p className="mt-2 mb-7 text-sm leading-relaxed text-axis-core/55">
                Your feedback helps us make investing through AxisKey easier for everyone.
              </p>

              <div className="mb-2 flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onClick={() => setRating(value)}
                    className={`p-1 text-[38px] leading-none transition-transform hover:scale-110 ${
                      value <= rating ? "text-axis-signal" : "text-axis-base"
                    }`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
              <div className="mb-7 flex justify-between px-1.5 text-[11px] text-axis-core/50">
                <span>Not great</span>
                <span>Excellent</span>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything you'd like to share? (optional)"
                rows={4}
                className="mb-5 w-full rounded-[6px] border border-axis-base/50 px-3.5 py-3 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
              />

              {state === "error" && (
                <p className="mb-4 rounded-[6px] bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={rating === 0 || state === "submitting"}
                className="w-full rounded-full bg-axis-signal py-[15px] text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "submitting" ? "Submitting..." : "Submit Feedback"}
              </button>
              <p className="mt-2 text-[11px] text-axis-core/50">
                Takes two seconds. Thank you for investing with AxisKey.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
