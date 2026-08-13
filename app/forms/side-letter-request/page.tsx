import type { Metadata } from "next";
import { SideLetterRequestForm } from "@/components/axiskey-forms/SideLetterRequestForm";

export const metadata: Metadata = {
  title: "Side Letter Request | AxisKey",
};

export default function SideLetterRequestPage() {
  return <SideLetterRequestForm />;
}
