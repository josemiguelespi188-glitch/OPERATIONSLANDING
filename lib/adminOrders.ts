/**
 * Decodes a raw "Payment Received Orders" (renamed "AxisKey Orders" in
 * ClickUp, Oct 2026 -- list id unchanged) task for the admin AxisKey
 * Orders table (`/admin/orders`). Deliberately reuses every field id and
 * decode rule from lib/orderTracking.ts rather than re-deriving them --
 * this is the exact same ClickUp list the investor-facing
 * /order-tracking/[token] page already reads, already confirmed live.
 *
 * Only fields with a confirmed id in ORDER_TRACKING_FIELD_IDS are
 * decoded here. The list has a few more fields visible in ClickUp's own
 * view (Issued Shares, New Investor, Tracking Link, Accreditation Email
 * Status) whose ids were never confirmed for this codebase -- rather
 * than guess, they're left out of this table for now; add them (and
 * extend AdminOrderRow) once their ids are confirmed the same way the
 * rest of this list's fields were (a real clickup_get_custom_fields call
 * or scripts/clickup/audit-fields.mjs-style check).
 */
import {
  ACCOUNT_TYPE_BY_INDEX,
  DEAL_TYPE_BY_INDEX,
  ORDER_TRACKING_FIELD_IDS,
  dropdownIndex,
  fieldValue,
  isChecked,
  numberValue,
  textValue,
  type ClickUpTaskRaw,
} from "./orderTracking";

export interface AdminOrderRow {
  taskId: string;
  orderNumber: string;
  statusText: string | null;
  investorName: string | null;
  currentAccountName: string | null;
  dealName: string | null;
  accountType: string | null;
  dealType: string | null;
  confirmedAmount: number | null;
  investorEmail: string | null;
  docsNeeded: string | null;
  issuedDateMs: number | null;
  dateCreatedMs: number | null;
  paymentNotReceived: boolean;
  saNotSigned: boolean;
  accreditationPending: boolean;
  accountNotConfirmed: boolean;
  kycIncomplete: boolean;
  hasCancelTransaction: boolean;
}

function epochMs(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function decodeOrderRow(task: ClickUpTaskRaw): AdminOrderRow {
  const f = ORDER_TRACKING_FIELD_IDS;

  const accountTypeIndex = dropdownIndex(fieldValue(task, f.accountTypeName));
  const dealTypeIndex = dropdownIndex(fieldValue(task, f.dealTypeId));

  return {
    taskId: task.id,
    orderNumber: task.name ?? task.id,
    statusText: task.status?.status ?? null,
    investorName: textValue(fieldValue(task, f.investorName)),
    currentAccountName: textValue(fieldValue(task, f.currentAccountName)),
    dealName: textValue(fieldValue(task, f.dealName)),
    accountType: accountTypeIndex !== null ? ACCOUNT_TYPE_BY_INDEX[accountTypeIndex] ?? null : null,
    dealType: dealTypeIndex !== null ? DEAL_TYPE_BY_INDEX[dealTypeIndex] ?? null : null,
    confirmedAmount: numberValue(fieldValue(task, f.confirmedAmount)),
    investorEmail: textValue(fieldValue(task, f.investorEmail)),
    docsNeeded: textValue(fieldValue(task, f.docsNeeded)),
    issuedDateMs: epochMs(fieldValue(task, f.issuedDate)),
    dateCreatedMs: epochMs(task.date_created),
    paymentNotReceived: isChecked(fieldValue(task, f.paymentNotReceived)),
    saNotSigned: isChecked(fieldValue(task, f.saNotSigned)),
    accreditationPending: isChecked(fieldValue(task, f.accreditationPending)),
    accountNotConfirmed: isChecked(fieldValue(task, f.accountNotConfirmed)),
    kycIncomplete: isChecked(fieldValue(task, f.kycIncomplete)),
    hasCancelTransaction: isChecked(fieldValue(task, f.hasCancelTransaction)),
  };
}
