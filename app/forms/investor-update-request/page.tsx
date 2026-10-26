import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestorUpdateRequestForm } from "@/components/axiskey-forms/InvestorUpdateRequestForm";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Whether this form is live can be toggled from the admin Form Builder
// (request_types.is_active) — always fetch the latest state instead of
// caching a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Update Request | AxisKey",
};

async function isActive(): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("request_types")
      .select("is_active")
      .eq("slug", "investor-update-request")
      .maybeSingle();
    // No row (not yet re-seeded) or a lookup failure both fail open to
    // visible, same default as every other locked form page.
    return data?.is_active !== false;
  } catch {
    return true;
  }
}

export default async function InvestorUpdateRequestPage() {
  if (!(await isActive())) notFound();
  return <InvestorUpdateRequestForm />;
}
