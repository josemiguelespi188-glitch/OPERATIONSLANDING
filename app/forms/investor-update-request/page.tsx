import type { Metadata } from "next";
import { InvestorUpdateRequestForm } from "@/components/axiskey-forms/InvestorUpdateRequestForm";

export const metadata: Metadata = {
  title: "Investor Update Request | AxisKey",
};

export default function InvestorUpdateRequestPage() {
  return <InvestorUpdateRequestForm />;
}
