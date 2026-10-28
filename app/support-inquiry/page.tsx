import type { Metadata } from "next";
import { SupportInquiryForm } from "@/components/support/SupportInquiryForm";

export const metadata: Metadata = {
  title: "Support Inquiry | AxisKey",
};

/**
 * Standalone, unauthenticated internal tool -- not a request form for
 * investors (it doesn't show up on the public Operations Hub homepage
 * grid), and not a hidden page either (it's linked from a button on
 * /admin's Overview). The page itself needs no admin login so the link
 * can be shared directly with any coworker: no PageShell/Sidebar, same
 * convention as /rate-your-experience and /schedule-a-call.
 */
export default function SupportInquiryPage() {
  return <SupportInquiryForm />;
}
