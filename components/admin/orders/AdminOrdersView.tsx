"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import type { AdminOrderRow } from "@/lib/adminOrders";

interface OrdersResponse {
  statusOrder: string[];
  rows: AdminOrderRow[];
  fetchedAt: string;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString();
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "";
  return `$${amount.toLocaleString("en-US")}`;
}

/** Checkbox columns on this list all mean "checked = problem/pending" (confirmed in lib/orderTracking.ts). */
function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-red-100 text-[10px] font-bold text-red-700">
      !
    </span>
  ) : (
    <span className="inline-block h-4 w-4 rounded-[4px] border border-axis-base/40" />
  );
}

const COLUMNS: { key: keyof AdminOrderRow | "flags"; label: string }[] = [
  { key: "orderNumber", label: "Order #" },
  { key: "investorName", label: "Investor Name" },
  { key: "currentAccountName", label: "Current Account Name" },
  { key: "dealName", label: "Offering" },
  { key: "accountType", label: "Account Type" },
  { key: "dealType", label: "Deal Type" },
  { key: "confirmedAmount", label: "Confirmed Amount" },
  { key: "investorEmail", label: "Investor Email" },
  { key: "docsNeeded", label: "Docs Needed" },
  { key: "issuedDateMs", label: "Issued Date" },
  { key: "dateCreatedMs", label: "Date Created" },
  { key: "paymentNotReceived", label: "Payment Not Received?" },
  { key: "saNotSigned", label: "SA Not Signed?" },
  { key: "accreditationPending", label: "Accreditation Pending?" },
  { key: "accountNotConfirmed", label: "Account Not Confirmed?" },
  { key: "kycIncomplete", label: "KYC Incomplete?" },
  { key: "hasCancelTransaction", label: "Has Cancel Transaction?" },
];

const FLAG_KEYS = new Set([
  "paymentNotReceived",
  "saNotSigned",
  "accreditationPending",
  "accountNotConfirmed",
  "kycIncomplete",
  "hasCancelTransaction",
]);

export function AdminOrdersView() {
  const adminFetch = useAdminFetch();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/orders");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load orders.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleGroup(status: string) {
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const groups = groupRows(data?.rows ?? [], data?.statusOrder ?? []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
          <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
            AxisKey Orders
          </h1>
          <p className="mt-1 max-w-xl text-sm text-axis-core/60">
            A live mirror of the AxisKey Orders list in ClickUp, grouped and ordered the same way.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.fetchedAt && !loading && (
            <span className="text-xs text-axis-core/40">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && !data && <p className="mt-10 text-center text-sm text-axis-core/50">Loading...</p>}

      {data && (
        <div className="mt-6 space-y-3">
          {groups.length === 0 && (
            <p className="rounded-[8px] border border-axis-base/30 bg-white px-4 py-6 text-center text-sm text-axis-core/50">
              No orders found.
            </p>
          )}
          {groups.map(([status, rows]) => (
            <div key={status} className="overflow-hidden rounded-card border border-axis-base/30 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(status)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-axis-light/60"
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-head text-sm font-semibold uppercase tracking-wide text-axis-core">
                    {status || "No status"}
                  </span>
                  <span className="rounded-full bg-axis-base/50 px-2 py-0.5 text-xs font-semibold text-axis-core">
                    {rows.length}
                  </span>
                </span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-axis-core/40 transition-transform duration-150 ${
                    openGroups.has(status) ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openGroups.has(status) && (
                <div className="overflow-x-auto border-t border-axis-base/20">
                  <table className="w-full min-w-[1400px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-axis-base/20 bg-axis-light/50">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className="whitespace-nowrap px-3 py-2 font-semibold text-axis-core/70"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={row.taskId}
                          className={i % 2 === 1 ? "bg-axis-light/20" : undefined}
                        >
                          {COLUMNS.map((col) => (
                            <td key={col.key} className="whitespace-nowrap px-3 py-2 text-axis-core/80">
                              {renderCell(row, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderCell(row: AdminOrderRow, key: string): React.ReactNode {
  if (FLAG_KEYS.has(key)) return <Flag on={Boolean(row[key as keyof AdminOrderRow])} />;
  if (key === "confirmedAmount") return formatAmount(row.confirmedAmount);
  if (key === "issuedDateMs") return formatMs(row.issuedDateMs);
  if (key === "dateCreatedMs") return formatMs(row.dateCreatedMs);
  if (key === "docsNeeded") {
    const v = row.docsNeeded;
    if (!v) return "";
    return (
      <span className="block max-w-[220px] truncate" title={v}>
        {v}
      </span>
    );
  }
  const value = row[key as keyof AdminOrderRow];
  return typeof value === "string" ? value : "";
}

/** Rows grouped by native ClickUp status, ordered the same way ClickUp's own list view orders its groups (statusOrder, server-provided from the list's live status workflow) -- any status not in that list (shouldn't normally happen) sorts after the known ones. */
function groupRows(rows: AdminOrderRow[], statusOrder: string[]): [string, AdminOrderRow[]][] {
  const byStatus = new Map<string, AdminOrderRow[]>();
  for (const row of rows) {
    const key = row.statusText ?? "";
    const list = byStatus.get(key);
    if (list) list.push(row);
    else byStatus.set(key, [row]);
  }

  const order = new Map(statusOrder.map((s, i) => [s, i]));
  return Array.from(byStatus.entries()).sort(([a], [b]) => {
    const ai = order.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || a.localeCompare(b);
  });
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
