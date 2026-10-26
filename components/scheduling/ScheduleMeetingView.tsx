"use client";

import Script from "next/script";
import { Logo } from "@/components/Logo";

const CALENDLY_URL =
  "https://calendly.com/d/dtv6-nwt-297/support-call?hide_gdpr_banner=1&background_color=f2f2f2&text_color=201c1a&primary_color=e3f464";

/**
 * Standalone, unauthenticated booking page meant to be shared directly
 * (pasted into an email, chat, or anywhere else) so a client or investor
 * can put time on AxisKey's calendar. No PageShell/Sidebar, no nav links
 * out -- same "no chrome" convention as RateYourExperienceForm.
 */
export function ScheduleMeetingView() {
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

        <div className="mt-8 overflow-hidden rounded-card bg-white shadow-card">
          <div
            className="calendly-inline-widget"
            data-url={CALENDLY_URL}
            style={{ minWidth: "320px", height: "700px" }}
          />
        </div>
      </div>

      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </main>
  );
}
