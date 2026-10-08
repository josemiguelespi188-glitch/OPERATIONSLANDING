import type { Metadata } from "next";
import { CommunicationReviewView } from "@/components/communicationsReview/CommunicationReviewView";

export const metadata: Metadata = {
  title: "Review Communication | AxisKey",
};

export const dynamic = "force-dynamic";

/**
 * Standalone public page the approval-request email's button links to.
 * Like /order-tracking/[token] and /rate-your-experience, deliberately
 * has no PageShell/Sidebar and no "back" navigation -- per explicit
 * instruction, clicking the email button should open directly into
 * this one communication's review screen and nothing else. The token
 * is a high-entropy random value (not an opaque-but-guessable id like
 * order_tracking_links' order number), since this one gates a write
 * action (approve / request changes), not just a read.
 */
export default async function CommunicationReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CommunicationReviewView token={token} />;
}
