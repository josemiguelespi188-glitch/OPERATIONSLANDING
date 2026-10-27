"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Logo } from "@/components/Logo";

const CALENDLY_URL =
  "https://calendly.com/d/dtv6-nwt-297/support-call?hide_gdpr_banner=1&background_color=f2f2f2&text_color=201c1a&primary_color=e3f464";

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
      <main className="flex min-h-screen items-center justify-center bg-axis-light px-6 py-12">
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

  return (
    <main className="min-h-screen bg-axis-light px-6 py-12">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <h1 className="text-center font-head text-[26px] font-medium leading-tight tracking-tight text-axis-core">
          Schedule a call with AxisKey
        </h1>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-sm leading-relaxed text-axis-core/55">
          Pick a time that works for you below and we will send a calendar invite with the
          meeting details.
        </p>

        {justBooked ? (
          <div className="mt-8 rounded-card bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-axis-signal text-2xl font-bold text-axis-core">
              &#10003;
            </div>
            <p className="font-head text-lg font-medium text-axis-core">You&rsquo;re all set.</p>
            <p className="mt-2 text-sm leading-relaxed text-axis-core/55">
              Your call is booked. This link has now been used and won&rsquo;t open again.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-card bg-white shadow-card">
            <div
              className="calendly-inline-widget"
              data-url={CALENDLY_URL}
              style={{ minWidth: "320px", height: "700px" }}
            />
          </div>
        )}
      </div>

      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </main>
  );
}
