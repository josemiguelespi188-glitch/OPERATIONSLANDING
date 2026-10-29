import type { Metadata } from "next";
import { SupportInquiryForm } from "@/components/support/SupportInquiryForm";
import { RequireAdminSession } from "@/components/auth/RequireAdminSession";

export const metadata: Metadata = {
  title: "Support Inquiry | AxisKey",
};

/**
 * Internal tool, not a request form for investors (it doesn't show up on
 * the public Operations Hub homepage grid). Reached from a button on
 * /admin's Overview, and (Oct 2026, per explicit instruction) now
 * requires the same login as /admin -- this used to be a no-login public
 * page so the link could be shared directly, but that was deliberately
 * reversed. RequireAdminSession is the same gate app/admin/layout.tsx
 * uses, just without PageShell/Sidebar around it, so the page keeps its
 * own standalone single-column look once signed in.
 */
export default function SupportInquiryPage() {
  return (
    <RequireAdminSession>
      <SupportInquiryForm />
    </RequireAdminSession>
  );
}
