"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Logo } from "@/components/Logo";

// primary_color is axis-base (#CEC1A9) rather than axis-signal (#E3F464) --
// the lime green barely shows against Calendly's own light gray background
// (confirmed from a live screenshot: selected date/times were nearly
// invisible), so the brand's tan token is used here instead.
const CALENDLY_URL =
  "https://calendly.com/d/dtv6-nwt-297/support-call?hide_gdpr_banner=1&background_color=f2f2f2&text_color=201c1a&primary_color=cec1a9";

interface ScheduleMeetingViewProps {
  /** Present only on the one-time route (/schedule-a-call/[token]). */
  token?: string;
  /** Server-checked: true once this token has already been used or doesn't exist. */
  invalid?: boolean;
}

/**
 * Standalone, unauthenticated booking page meant to be shared directly
 * (pasted into an email, chat, or anywhere else) so a client or investor
 * can put time on AxisKey's calendar. No PageShell/Sidebar, no nav links
 * out -- same "no chrome" convention as RateYourExperienceForm.
 *
 * Two modes, sharing this one component:
 * - /schedule-a-call (no token): the plain evergreen link, unlimited use.
 * - /schedule-a-call/[token]: a one-time link generated from the admin
 *   Overview page. There's no Calendly API token in this codebase, so
 *   "used" is detected client-side -- Calendly's embedded widget already
 *   posts a `calendly.event_scheduled` window message the moment a
 *   booking completes inside the iframe; we listen for it and call
 *   /api/schedule-links/[token]/consume, then swap the widget out for a
 *   thank-you card so the same browser tab can't rebook either.
 */
export function ScheduleMeetingView({ token, invalid }: ScheduleMeetingViewProps) {
  const [justBooked, setJustBooked] = useState(false);

  useEffect(() => {
    if (!token || invalid) return;

    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("calendly.com")) return;
      if (event.data?.event !== "calendly.event_scheduled") return;

      setJustBooked(true);
      fetch(`/api/schedule-links/${token}/consume`, { method: "POST" }).catch(() => {});
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [token, invalid]);

  if (invalid) {
    return (
      <main className="flex h-[100dvh] items-center justify-center overflow-hidden bg-axis-light px-6">
        <div className="w-full max-w-md rounded-card border border-axis-base/30 bg-white p-8 text-center shadow-card">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <p className="font-head text-lg font-bold text-axis-core">
            This scheduling link is no longer valid.
          </p>
          <p className="mt-2 text-sm text-axis-core/60">
            It has already been used to book a call, or the link isn&rsquo;t valid. Ask for a new
            one.
          </p>
        </div>
      </main>
    );
  }

  // Fixed to the viewport height with no outer scroll (the Calendly
  // widget fills whatever vertical space is left and scrolls
  // internally on its own, same as the fixed-height split used on
  // /communications-review/[token]) -- per explicit feedback that the
  // page previously required scrolling past the header to reach the
  // calendar.
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-axis-light px-6 py-5">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex shrink-0 justify-center">
          <Logo />
        </div>

        <h1 className="shrink-0 text-center font-head text-xl font-medium leading-tight tracking-tight text-axis-core sm:text-[26px]">
          Schedule a call with AxisKey Support
        </h1>
        <p className="mx-auto mt-1 max-w-[520px] shrink-0 text-center text-xs leading-relaxed text-axis-core/55 sm:text-sm">
          Pick a time that works for you below and we will send a calendar invite with the
          meeting details.
        </p>

        {justBooked ? (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-card bg-white p-10 text-center shadow-card">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-axis-signal text-2xl font-bold text-axis-core">
              &#10003;
            </div>
            <p className="font-head text-lg font-medium text-axis-core">You&rsquo;re all set.</p>
            <p className="mt-2 text-sm leading-relaxed text-axis-core/55">
              Your call is booked. This link has now been used and won&rsquo;t open again.
            </p>
          </div>
        ) : (
          <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-card bg-white shadow-card">
            <div
              className="calendly-inline-widget h-full w-full"
              data-url={CALENDLY_URL}
              style={{ minWidth: "320px", height: "100%" }}
            />
          </div>
        )}
      </div>

      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </main>
  );
}
