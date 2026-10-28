import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { fetchAllListTasks, fetchListDetails } from "@/lib/integrations/clickup";
import { ORDER_TRACKING_LIST_ID, type ClickUpTaskRaw } from "@/lib/orderTracking";
import { decodeOrderRow } from "@/lib/adminOrders";

export const dynamic = "force-dynamic";

interface ClickUpListStatus {
  status?: string;
  orderindex?: number;
}

/**
 * Live mirror of the AxisKey Orders ClickUp list (same list id as Order
 * Tracking's investor-facing page, ORDER_TRACKING_LIST_ID -- the user
 * renamed the list from "Payment Received Orders" to "AxisKey Orders" in
 * ClickUp, Oct 2026, but the id is unchanged). Never cached: fetched
 * fresh on every call, since the admin page calls this both on load and
 * from its own "Refresh" button.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.CLICKUP_API_TOKEN) {
    return NextResponse.json({ error: "CLICKUP_API_TOKEN is not configured." }, { status: 503 });
  }

  const [listDetails, tasks] = await Promise.all([
    fetchListDetails(ORDER_TRACKING_LIST_ID),
    fetchAllListTasks(ORDER_TRACKING_LIST_ID),
  ]);

  const statuses = (listDetails?.statuses as ClickUpListStatus[] | undefined) ?? [];
  const statusOrder = statuses
    .slice()
    .sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0))
    .map((s) => s.status)
    .filter((s): s is string => !!s);

  const rows = tasks.map((task) => decodeOrderRow(task as unknown as ClickUpTaskRaw));

  return NextResponse.json({ statusOrder, rows, fetchedAt: new Date().toISOString() });
}
