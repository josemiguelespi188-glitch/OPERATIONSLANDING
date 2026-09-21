import type { Metadata } from "next";
import { RateYourExperienceForm } from "@/components/feedback/RateYourExperienceForm";

export const metadata: Metadata = {
  title: "Rate Your Experience | AxisKey",
};

/**
 * Standalone public landing page linked from transactional emails (e.g.
 * "Allocation Confirmed"). Deliberately outside the Operations Hub's
 * public catalog and admin section: no layout wraps this route in
 * PageShell/Sidebar, so it renders with none of the rest of the app's
 * navigation. No auth guard applies either, since this route sits outside
 * app/admin (the only section gated by session checks in this app).
 */
export default function RateYourExperiencePage() {
  return <RateYourExperienceForm />;
}
