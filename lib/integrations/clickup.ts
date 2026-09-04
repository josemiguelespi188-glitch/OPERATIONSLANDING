import type { AttachmentInput, RequestPayload } from "../types";

export interface ClickUpSyncResult {
  synced: boolean;
  taskId: string | null;
  error?: string;
}

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

const TASK_LABEL: Record<string, string> = {
  "title-transfer-request": "Title Transfer",
  "redemption-request": "Redemption",
  "ira-funding-request": "IRA Funding",
  "refund-request": "Refund",
  "side-letter-request": "Side Letter",
  "investor-information-update": "Investor Update",
  "account-maintenance-request": "Account Maintenance",
  "document-request": "Investor Documentation",
  "axiskey-report-request": "AxisKey Report",
};

/**
 * Request type slug -> ClickUp List ID. Configured entirely through
 * CLICKUP_LIST_ID_MAP (a JSON object), never hardcoded, e.g.:
 *   {"ira-funding-request":"901234567","title-transfer-request":"901234568"}
 */
function getListIdMap(): Record<string, string> {
  const raw = process.env.CLICKUP_LIST_ID_MAP;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * One ClickUp custom field target for a payload.customFields key. "text"
 * passes the value through as-is (also used for ClickUp's "email" field
 * type, which just takes a string); "number" strips non-numeric
 * characters (covers both ClickUp's number and currency field types);
 * "dropdown" translates our form's option text into the option's ClickUp
 * UUID; "checkbox" maps our "Yes"/"" convention to a boolean.
 */
type ClickUpFieldTarget =
  | { id: string; kind: "text" }
  | { id: string; kind: "number" }
  | { id: string; kind: "checkbox" }
  | { id: string; kind: "dropdown"; options: Record<string, string> };

/**
 * Request type slug -> { payload.customFields key -> one or more ClickUp
 * custom field targets }. Field IDs are per-list (not per-workspace), so
 * this only covers lists that have been mapped by hand against their real
 * ClickUp fields — confirmed by reading actual submitted tasks in each
 * list (see the ClickUp sync notice in the app for the caveats). A
 * request type or key with no entry here simply skips custom-field sync —
 * the data still lands in the task description via buildTaskDescription.
 */
const CUSTOM_FIELD_MAP: Record<string, Record<string, ClickUpFieldTarget[]>> = {
  "title-transfer-request": {
    currentAccountName: [{ id: "3026a4c9-b01c-41cb-ab92-87b2cf417ba1", kind: "text" }],
    newAccountName: [{ id: "0de379f0-b634-44ad-b5cc-ef75f46359ed", kind: "text" }],
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
  },
  "redemption-request": {
    investorAccountName: [{ id: "3026a4c9-b01c-41cb-ab92-87b2cf417ba1", kind: "text" }],
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    // Real submitted tasks always have both amount fields filled with the
    // same value — send to both.
    redemptionAmount: [
      { id: "d90c8115-3271-4597-89ac-bfac73e77c28", kind: "number" },
      { id: "e98c4094-ee91-4886-b1c7-78a0da31d092", kind: "number" },
    ],
    // The form's dropdown now shows "Full"/"Partial" (per the current
    // spec), but both still resolve to the same confirmed ClickUp option
    // UUIDs, which live under the ClickUp-side option names "Full
    // Redemption"/"Partial Redemption" — only our form's label changed.
    redemptionType: [
      {
        id: "be5ab0e3-b125-4f58-ae22-8831e67dc294",
        kind: "dropdown",
        options: {
          Full: "6507524b-2070-4586-b0a9-44177f7822b8",
          Partial: "e93f8731-85ef-4523-a32d-cb3ee259d522",
        },
      },
    ],
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
  },
  "ira-funding-request": {
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    custodian: [{ id: "f2d63342-eb0e-48f8-a930-4c183fa65284", kind: "text" }],
    amountInvesting: [{ id: "5bbae178-213c-4daf-9af2-becc105f0bbd", kind: "number" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    ccEmail: [{ id: "715f4b75-677f-40ab-98e7-42c21bcb4a02", kind: "text" }],
  },
  // refund-request has no entry yet — it's a brand-new ClickUp list
  // (901114418101). Run scripts/clickup/provision-forms.mjs and add the
  // returned field IDs here.
  //
  // The 4 lists below were re-provisioned (Aug 2026) after their fields
  // changed — "Note", "Offering Name", "Investor Email", and "Requester
  // Email" are shared/workspace-level fields, so the same field ID shows
  // up across several lists.
  "side-letter-request": {
    orderNumber: [{ id: "dd1e7aa6-164d-445a-a0a8-c66618120fa7", kind: "text" }],
    offeringName: [{ id: "c438a21a-8fc0-4f25-a4c8-cf1ece1ead25", kind: "text" }],
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    requesterEmail: [{ id: "9637efe7-f098-4ae7-8494-be2698a1617e", kind: "text" }],
    // sideLetterType (dropdown: Double Bonus Months / Additional
    // Annualized Return / Fee Waiver / Other) replaces the old free-text
    // "Side Letter Terms" field — re-run the provisioning script to
    // create it and add it here with its option IDs.
  },
  "investor-information-update": {
    offeringName: [{ id: "c438a21a-8fc0-4f25-a4c8-cf1ece1ead25", kind: "text" }],
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "9637efe7-f098-4ae7-8494-be2698a1617e", kind: "text" }],
    // orderNumber is new on this list — re-run the provisioning script to
    // create it and add it here.
  },
  "account-maintenance-request": {
    offeringName: [{ id: "c438a21a-8fc0-4f25-a4c8-cf1ece1ead25", kind: "text" }],
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "9637efe7-f098-4ae7-8494-be2698a1617e", kind: "text" }],
  },
  // document-request has no entry yet — this list has never been
  // provisioned. Run scripts/clickup/provision-forms.mjs and add the
  // returned field IDs here.
  "axiskey-report-request": {
    offeringName: [{ id: "c438a21a-8fc0-4f25-a4c8-cf1ece1ead25", kind: "text" }],
    reportPeriod: [{ id: "cb587ee2-a6fc-479e-9bd3-ed9c3ab9b2ce", kind: "text" }],
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    requesterEmail: [{ id: "9637efe7-f098-4ae7-8494-be2698a1617e", kind: "text" }],
    // reportType's option set changed entirely (it's no longer
    // Distribution History/Account Statement/etc.) — the ClickUp
    // dropdown field still has the old options and needs them replaced
    // manually in ClickUp before this can be wired back in; the
    // provisioning script only creates a dropdown once, it doesn't
    // update an existing one's options.
  },
};

/**
 * Request type slug -> { AttachmentInput.fieldKey -> ClickUp
 * attachment-type custom field ID }. Populated after the file is uploaded
 * as a regular task attachment (see attachTaskFile).
 */
const ATTACHMENT_FIELD_MAP: Record<string, Record<string, string>> = {
  "title-transfer-request": {
    titleTransferComplete: "3d082ed6-621a-4546-bff8-315544c7bc05", // "Additional File"
  },
  "redemption-request": {
    redemptionAgreement: "3d082ed6-621a-4546-bff8-315544c7bc05", // "Additional File"
  },
  "ira-funding-request": {
    subscriptionAgreement: "8438e487-dd9b-4cf1-846e-426ee12722ef",
  },
  // refund-request has a required file field (refundDocumentation) but no
  // confirmed attachment field ID yet — pending provisioning.
  // Side Letter, Investor Information Update, and Account Maintenance no
  // longer have a file upload field per the current form spec.
  // Investor Documentation Request and Request an AxisKey Report never
  // had one.
};

/** ClickUp number/currency fields take a plain number, e.g. 23211 or 23211.5. */
function parseNumericValue(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Resolves a raw form value into the value ClickUp's field API expects. */
function resolveFieldValue(target: ClickUpFieldTarget, rawValue: string): unknown | null {
  switch (target.kind) {
    case "text":
      return rawValue;
    case "number":
      return parseNumericValue(rawValue);
    case "checkbox":
      return rawValue === "Yes";
    case "dropdown":
      return target.options[rawValue] ?? null;
  }
}

/**
 * These 3 lists want the task name to be just the investor's name (no
 * label/pipe prefix) — matches how the ops team names tasks manually:
 *   ira-funding-request    -> Investor Account Name
 *   title-transfer-request -> Investor Name
 *   redemption-request     -> Investor Name
 * payload.investorName is already sourced from the right form field for
 * each of these (see each page's submissionMapping.investorNameField).
 */
const INVESTOR_NAME_ONLY_TASK_TYPES = new Set([
  "ira-funding-request",
  "title-transfer-request",
  "redemption-request",
]);

function buildTaskName(payload: RequestPayload): string {
  if (INVESTOR_NAME_ONLY_TASK_TYPES.has(payload.requestType)) {
    return payload.investorName || payload.requestorName;
  }

  const label = TASK_LABEL[payload.requestType] ?? payload.requestTypeName;
  const subject = payload.dealName || payload.investorName || payload.requestorName;
  return `${label} | ${payload.requestorName} | ${subject}`;
}

function buildTaskDescription(payload: RequestPayload): string {
  const lines = [
    `**Request Type:** ${payload.requestTypeName}`,
    `**Investor Name:** ${payload.investorName || "N/A"}`,
    `**Deal Name:** ${payload.dealName || "N/A"}`,
    `**Email:** ${payload.requestorEmail}`,
    `**Created By:** ${payload.requestorName}`,
    `**Submission Date:** ${payload.submittedAt}`,
    "",
    "**Notes:**",
    payload.notes || "N/A",
  ];

  if (payload.attachments.length > 0) {
    lines.push("", "**Attachments:**");
    for (const attachment of payload.attachments) {
      lines.push(`- [${attachment.fileName}](${attachment.fileUrl})`);
    }
  }

  return lines.join("\n");
}

/**
 * Creates a ClickUp task for a submitted request. Never throws — every
 * failure mode (missing config, network error, non-2xx response) is
 * surfaced as a structured result so the caller can persist a sync status
 * in Supabase instead of losing the request.
 */
export async function syncRequestToClickUp(
  payload: RequestPayload
): Promise<ClickUpSyncResult> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    return {
      synced: false,
      taskId: null,
      error: "CLICKUP_API_TOKEN is not configured.",
    };
  }

  const listId = getListIdMap()[payload.requestType];
  if (!listId) {
    return {
      synced: false,
      taskId: null,
      error: `No ClickUp List ID configured for "${payload.requestType}" in CLICKUP_LIST_ID_MAP.`,
    };
  }

  let taskId: string;
  try {
    const response = await fetch(`${CLICKUP_API_BASE}/list/${listId}/task`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: buildTaskName(payload),
        description: buildTaskDescription(payload),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        synced: false,
        taskId: null,
        error: `ClickUp API error ${response.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = (await response.json()) as { id: string };
    taskId = data.id;
  } catch (error) {
    return {
      synced: false,
      taskId: null,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error creating the ClickUp task.",
    };
  }

  // Best-effort: attach the actual files when the API allows it, and link
  // them into their matching attachment-type custom field. A failure here
  // never fails the sync — the file URLs are already in the task
  // description as a fallback per the attachment requirements.
  const attachmentFieldIds = ATTACHMENT_FIELD_MAP[payload.requestType] ?? {};
  await Promise.all(
    payload.attachments.map(async (attachment) => {
      const attachmentId = await attachTaskFile(taskId, attachment, token);
      const fieldId = attachment.fieldKey ? attachmentFieldIds[attachment.fieldKey] : undefined;
      if (attachmentId && fieldId) {
        await setCustomField(taskId, fieldId, { add: [attachmentId] }, token);
      }
    })
  );

  // Best-effort: populate the structured custom fields this list is known
  // to have (see CUSTOM_FIELD_MAP). Never fails the sync.
  const fieldTargets = CUSTOM_FIELD_MAP[payload.requestType];
  if (fieldTargets) {
    const writes: Promise<void>[] = [];
    for (const [key, targets] of Object.entries(fieldTargets)) {
      const rawValue = payload.customFields[key];
      if (!rawValue) continue;
      for (const target of targets) {
        const value = resolveFieldValue(target, rawValue);
        if (value === null) continue;
        writes.push(setCustomField(taskId, target.id, value, token));
      }
    }
    await Promise.all(writes);
  }

  return { synced: true, taskId };
}

async function setCustomField(
  taskId: string,
  fieldId: string,
  value: unknown,
  token: string
): Promise<void> {
  try {
    await fetch(`${CLICKUP_API_BASE}/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });
  } catch {
    // Non-fatal — the value is already visible in the task description.
  }
}

/** Returns the uploaded attachment's ClickUp ID, or null on failure. */
async function attachTaskFile(
  taskId: string,
  attachment: AttachmentInput,
  token: string
): Promise<string | null> {
  try {
    const fileResponse = await fetch(attachment.fileUrl);
    if (!fileResponse.ok) return null;
    const blob = await fileResponse.blob();

    const form = new FormData();
    form.append("attachment", blob, attachment.fileName);

    const response = await fetch(`${CLICKUP_API_BASE}/task/${taskId}/attachment`, {
      method: "POST",
      headers: { Authorization: token },
      body: form,
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    // Non-fatal — the file URL is already in the task description.
    return null;
  }
}
