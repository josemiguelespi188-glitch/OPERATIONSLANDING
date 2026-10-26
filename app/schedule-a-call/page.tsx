import type { Metadata } from "next";
import { ScheduleMeetingView } from "@/components/scheduling/ScheduleMeetingView";

export const metadata: Metadata = {
  title: "Schedule a Call | AxisKey",
};

/**
 * Standalone public page meant to be shared directly (e.g. pasted into an
 * email or chat) so a client or investor can book time on AxisKey's
 * calendar via the embedded Calendly widget. Deliberately "hidden": not
 * linked from the homepage, the public Operations Hub catalog, or the
 * admin nav -- reachable only by whoever is given this URL, same
 * convention as /rate-your-experience and /order-tracking/[token]. No
 * PageShell/Sidebar, no auth guard.
 */
export default function ScheduleMeetingPage() {
  return <ScheduleMeetingView />;
}
