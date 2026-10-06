/**
 * Decodes a raw ClickUp "Payment Received Orders" task (list id
 * ORDER_TRACKING_LIST_ID below) into the view model the investor-facing
 * /order-tracking/[token] page renders.
 *
 * Every field id and value-encoding quirk here was confirmed against live
 * ClickUp data (clickup_get_custom_fields + two real sample tasks), never
 * guessed:
 *  - Every status checkbox on this list means "checked = problem/pending".
 *  - accountTypeName / dealTypeId are dropdown fields whose value is the
 *    option's numeric orderindex, not the option's UUID.
 *  - hasCancelTransaction is a separate, reliable cancel signal (distinct
 *    from the native "canceled orders" status, which is authoritative for
 *    terminal states per product decision below).
 */

export const ORDER_TRACKING_LIST_ID = "901113961474";

/**
 * No SITE_URL-style env var exists anywhere else in this codebase
 * (checked). NEXT_PUBLIC_SITE_URL is optional here -- set it on Vercel if
 * the production domain ever changes; otherwise this falls back to the
 * domain already used elsewhere in this app (e.g. the rate-your-experience
 * email link).
 */
export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://operationslanding.vercel.app";
}

export const ORDER_TRACKING_FIELD_IDS = {
  issuedDate: "06b03ab3-73d7-4998-8c66-b003e090a91f",
  accountNotConfirmed: "11c6a10f-bf0a-4563-804e-7085b7408832",
  accreditationPending: "255fdd25-554d-46ad-8c27-50a3134eafa6",
  hasCancelTransaction: "27a1619c-8462-4b78-b0ce-a22dcfed2dc4",
  currentAccountName: "3026a4c9-b01c-41cb-ab92-87b2cf417ba1",
  confirmedAmount: "3bd37fbc-617b-4e92-b27f-03f9386c0c81",
  docsNeeded: "3ca40fe1-7476-4b9b-8894-7fea2eac13af",
  investorEmail: "6429a23e-370b-40f8-ac77-f8273b2b7787",
  paymentNotReceived: "84cd3ca2-954a-43ec-8bc3-9da0d1b35b13",
  investorName: "a0ed02d8-c471-4996-ba86-2e8d238cbd0e",
  dealTypeId: "aada8c59-cf06-4c0c-9184-2acc347334db",
  dealName: "b437a737-51a8-45a8-8c72-783ef8e5d6f5",
  accountTypeName: "c875cbb9-87e1-4393-8836-dc663ef630dc",
  saNotSigned: "cb60a6ed-bb25-4b84-948a-78cc4ef0faa0",
  kycIncomplete: "d7ff4d4b-6181-4457-a3df-2a9f4bd3c92f",
} as const;

const ACCOUNT_TYPE_BY_INDEX: Record<number, string> = {
  0: "Individual",
  1: "IRA or Similar Benefit Plan",
  2: "Corporations/Partnerships",
  3: "Joint Account",
  4: "Revocable Trust",
  5: "Irrevocable Trust",
  6: "401K",
  7: "Disregarded Entity",
  8: "Non-Profit Entity",
};

const DEAL_TYPE_BY_INDEX: Record<number, string> = {
  0: "506-B",
  1: "Info",
  2: "506C",
  3: "Certificate Definition",
  4: "Reg CF",
  5: "Reg A",
};

export interface ClickUpCustomFieldRaw {
  id: string;
  value?: unknown;
}

export interface ClickUpTaskRaw {
  id: string;
  name?: string;
  status?: { status?: string; type?: string };
  custom_fields?: ClickUpCustomFieldRaw[];
  list?: { id?: string };
}

export type OrderScenario =
  | "pending_documents"
  | "pending_payment"
  | "processing"
  | "completed"
  | "canceled";

export interface OrderTrackingStep {
  label: string;
  state: "complete" | "current" | "upcoming" | "canceled";
}

export interface OrderTrackingChecklistItem {
  label: string;
  complete: boolean;
}

export interface OrderTrackingView {
  taskId: string;
  orderName: string;
  investorName: string | null;
  currentAccountName: string | null;
  dealName: string | null;
  accountType: string | null;
  dealType: string | null;
  confirmedAmount: number | null;
  nativeStatusText: string | null;
  scenario: OrderScenario;
  steps: OrderTrackingStep[];
  checklist: OrderTrackingChecklistItem[];
  docsNeeded: string | null;
  headline: string;
  explanation: string;
  nextStep: string;
}

function fieldValue(task: ClickUpTaskRaw, fieldId: string): unknown {
  return task.custom_fields?.find((field) => field.id === fieldId)?.value;
}

function isChecked(value: unknown): boolean {
  return value === true || value === "true";
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dropdownIndex(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function computeOrderTrackingView(task: ClickUpTaskRaw): OrderTrackingView {
  const f = ORDER_TRACKING_FIELD_IDS;

  const saNotSigned = isChecked(fieldValue(task, f.saNotSigned));
  const kycIncomplete = isChecked(fieldValue(task, f.kycIncomplete));
  const accreditationPending = isChecked(fieldValue(task, f.accreditationPending));
  const accountNotConfirmed = isChecked(fieldValue(task, f.accountNotConfirmed));
  const paymentNotReceived = isChecked(fieldValue(task, f.paymentNotReceived));
  const hasCancelTransaction = isChecked(fieldValue(task, f.hasCancelTransaction));

  const investorName = textValue(fieldValue(task, f.investorName));
  const currentAccountName = textValue(fieldValue(task, f.currentAccountName));
  const dealName = textValue(fieldValue(task, f.dealName));
  const confirmedAmount = numberValue(fieldValue(task, f.confirmedAmount));
  const docsNeeded = textValue(fieldValue(task, f.docsNeeded));

  const accountTypeIndex = dropdownIndex(fieldValue(task, f.accountTypeName));
  const accountType = accountTypeIndex !== null ? ACCOUNT_TYPE_BY_INDEX[accountTypeIndex] ?? null : null;
  const dealTypeIndex = dropdownIndex(fieldValue(task, f.dealTypeId));
  const dealType = dealTypeIndex !== null ? DEAL_TYPE_BY_INDEX[dealTypeIndex] ?? null : null;

  const nativeStatusText = task.status?.status?.toLowerCase() ?? null;

  const isNativelyCanceled = nativeStatusText === "canceled orders" || hasCancelTransaction;
  // Deliberately NOT falling back to `nativeStatusType === "done"` here --
  // confirmed live that ClickUp marks both "completed orders" AND
  // "canceled orders" with type "done" on this list, so that fallback
  // would misclassify every canceled order as completed. Text match only.
  const isNativelyCompleted = nativeStatusText === "completed orders" || nativeStatusText === "close";

  // Independent, per-dimension completion -- ClickUp's real data is not
  // guaranteed to resolve these in a fixed order (e.g. payment can land
  // before KYC/documents are finished, or vice versa), so each dimension
  // is computed from its own fields rather than derived from a single
  // linear "scenario" state machine.
  const complianceClear = !saNotSigned && !kycIncomplete && !accreditationPending && !accountNotConfirmed;
  // The "not received" checkbox can be unset simply because ops hasn't
  // touched a brand-new order yet, which would otherwise read as a false
  // "payment received" -- the native-status fallback guards against that.
  const paymentComplete = !paymentNotReceived && nativeStatusText !== "new pending orders";

  let scenario: OrderScenario;
  // Per product decision: for a terminal order, ClickUp's native Status
  // column is authoritative over any individual checkbox field, which can
  // be stale on older orders (confirmed via live sample data) and should
  // never override "completed"/"canceled" once ClickUp itself says so.
  if (isNativelyCanceled && !isNativelyCompleted) {
    scenario = "canceled";
  } else if (isNativelyCompleted) {
    scenario = "completed";
  } else if (!complianceClear) {
    // Documents are still outstanding regardless of payment status --
    // this is the umbrella UI scenario (dark panel + KYC buttons +
    // requirements modal) whether or not payment has also come in; the
    // narrative text below distinguishes the two cases.
    scenario = "pending_documents";
  } else if (!paymentComplete) {
    scenario = "pending_payment";
  } else {
    scenario = "processing";
  }

  // For a terminal "completed" order, native Status is authoritative over
  // every individual checkbox (same principle as the canceled/completed
  // scenario decision above) -- an older order can have a stale checkbox
  // that was simply never flipped after the fact, which must not make a
  // genuinely finished order display as still "in progress" anywhere on
  // the page, stepper or checklist alike.
  const isTerminalComplete = scenario === "completed";

  const steps: OrderTrackingStep[] = buildSteps({
    isCanceled: scenario === "canceled",
    docsComplete: isTerminalComplete || complianceClear,
    paymentComplete: isTerminalComplete || paymentComplete,
    orderComplete: isTerminalComplete,
  });
  const checklist: OrderTrackingChecklistItem[] = [
    { label: "Subscription agreement signed", complete: isTerminalComplete || !saNotSigned },
    { label: "Identity verification (KYC)", complete: isTerminalComplete || !kycIncomplete },
    { label: "Accreditation confirmed", complete: isTerminalComplete || !accreditationPending },
    { label: "Account confirmed", complete: isTerminalComplete || !accountNotConfirmed },
  ];

  const { headline, explanation, nextStep } = buildNarrative(scenario, {
    investorName,
    dealName,
    docsNeeded,
    paymentComplete,
  });

  return {
    taskId: task.id,
    orderName: task.name ?? "Your order",
    investorName,
    currentAccountName,
    dealName,
    accountType,
    dealType,
    confirmedAmount,
    nativeStatusText: task.status?.status ?? null,
    scenario,
    steps,
    checklist,
    docsNeeded: scenario === "pending_documents" ? docsNeeded : null,
    headline,
    explanation,
    nextStep,
  };
}

/**
 * Each of the first three dimensions is independent -- ClickUp data has
 * shown real orders where payment is received before documentation is
 * complete, not just the reverse, so "Documentation & compliance" and
 * "Payment received" are each marked from their own fields rather than
 * one gating the other. Only "Order complete" is genuinely downstream of
 * both (it reflects ClickUp's own terminal status, not something this
 * investor can affect directly).
 */
function buildSteps(input: {
  isCanceled: boolean;
  docsComplete: boolean;
  paymentComplete: boolean;
  orderComplete: boolean;
}): OrderTrackingStep[] {
  if (input.isCanceled) {
    return [
      { label: "Order submitted", state: "complete" },
      { label: "Documentation & compliance", state: "canceled" },
      { label: "Payment received", state: "canceled" },
      { label: "Order complete", state: "canceled" },
    ];
  }

  const finalState: OrderTrackingStep["state"] = input.orderComplete
    ? "complete"
    : input.docsComplete && input.paymentComplete
      ? "current"
      : "upcoming";

  return [
    { label: "Order submitted", state: "complete" },
    { label: "Documentation & compliance", state: input.docsComplete ? "complete" : "current" },
    { label: "Payment received", state: input.paymentComplete ? "complete" : "current" },
    { label: "Order complete", state: finalState },
  ];
}

function buildNarrative(
  scenario: OrderScenario,
  context: {
    investorName: string | null;
    dealName: string | null;
    docsNeeded: string | null;
    paymentComplete: boolean;
  }
): { headline: string; explanation: string; nextStep: string } {
  const deal = context.dealName ? `your ${context.dealName} order` : "your order";

  switch (scenario) {
    case "pending_documents":
      if (context.paymentComplete) {
        return {
          headline: "Payment received, a few documents are still needed",
          explanation: `We have received payment for ${deal}. It is on hold until your account documentation and compliance checks are also complete.`,
          nextStep: "Upload the requested documents to your investor portal (see requirements below).",
        };
      }
      return {
        headline: "We need a few documents from you",
        explanation: `${deal
          .charAt(0)
          .toUpperCase()}${deal.slice(1)} is on hold until your account documentation and compliance checks are complete.`,
        nextStep: "Upload the requested documents to your investor portal (see requirements below).",
      };
    case "pending_payment":
      return {
        headline: "Your documents are confirmed, waiting on payment",
        explanation: `Your account and compliance checks for ${deal} are complete. We are now waiting to receive your payment.`,
        nextStep: "If you have already sent your payment, it can take a few business days to be confirmed. Contact your Investor Relations representative if you have questions.",
      };
    case "processing":
      return {
        headline: "Your order is being finalized",
        explanation: `Your payment for ${deal} has been received and your order is being finalized.`,
        nextStep: "No action is needed from you right now. We will notify you as soon as your order is complete.",
      };
    case "completed":
      return {
        headline: "Your order is complete",
        explanation: `${deal.charAt(0).toUpperCase()}${deal.slice(1)} has been fully processed and allocated.`,
        nextStep: "You can view your allocation details in your investor portal at any time.",
      };
    case "canceled":
      return {
        headline: "This order was canceled",
        explanation: `${deal.charAt(0).toUpperCase()}${deal.slice(1)} was canceled and is no longer being processed.`,
        nextStep: "If you believe this is a mistake, please contact your Investor Relations representative.",
      };
  }
}
