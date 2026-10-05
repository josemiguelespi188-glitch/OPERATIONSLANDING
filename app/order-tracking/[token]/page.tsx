import type { Metadata } from "next";
import { OrderTrackingView } from "@/components/orderTracking/OrderTrackingView";

export const metadata: Metadata = {
  title: "Track Your Investment | AxisKey",
};

export const dynamic = "force-dynamic";

/**
 * Standalone public page linked from automatic investor emails. Like
 * /rate-your-experience, deliberately has no PageShell/Sidebar and no auth
 * guard -- it sits outside both the Operations Hub public catalog and
 * app/admin. The token in the URL is an opaque, server-generated id (see
 * order_tracking_links); it carries no information on its own and resolves
 * to a ClickUp task only via the service-role lookup in
 * GET /api/order-tracking/[token].
 */
export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OrderTrackingView token={token} />;
}
