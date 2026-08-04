import type { AttachmentInput, RequestPayload } from "../types";

export interface ClickUpSyncResult {
  synced: boolean;
  taskId: string | null;
  error?: string;
}

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

const TASK_LABEL: Record<string, string> = {
  "ira-funding-request": "IRA Funding",
  "title-transfer-request": "Title Transfer",
  "redemption-request": "Redemption",
  "investor-information-update": "Investor Update",
  "account-maintenance-request": "Account Maintenance",
  "document-request": "Document Request",
  "custom-request": "Custom Request",
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
 * Request type slug -> { payload.customFields key -> ClickUp custom field
 * ID }. Field IDs are per-list (not per-workspace), so this only covers
 * lists that have been mapped by hand against their real ClickUp fields.
 * A request type with no entry here simply skips custom-field sync — the
 * data still lands in the task description via buildTaskDescription.
 */
const CUSTOM_FIELD_MAP: Record<string, Record<string, string>> = {
  "ira-funding-request": {
    offeringName: "3a84a910-2a20-4c12-984f-d3e89926550a",
    custodian: "f2d63342-eb0e-48f8-a930-4c183fa65284",
    amountInvesting: "5bbae178-213c-4daf-9af2-becc105f0bbd",
    orderNumber: "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
    ccEmail: "715f4b75-677f-40ab-98e7-42c21bcb4a02",
  },
};

/**
 * Request type slug -> { AttachmentInput.fieldKey -> ClickUp
 * attachment-type custom field ID }. Populated after the file is uploaded
 * as a regular task attachment (see attachTaskFile).
 */
const ATTACHMENT_FIELD_MAP: Record<string, Record<string, string>> = {
  "ira-funding-request": {
    subscriptionAgreement: "8438e487-dd9b-4cf1-846e-426ee12722ef",
  },
};

/** ClickUp currency fields take a plain number, e.g. 23211 or 23211.5. */
function parseCurrencyValue(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function buildTaskName(payload: RequestPayload): string {
  const label = TASK_LABEL[payload.requestType] ?? payload.requestTypeName;
  const subject = payload.dealName || payload.investorName || payload.requestorName;
  return `${label} | ${payload.requestorName} | ${subject}`;
}

function buildTaskDescription(payload: RequestPayload): string {
  const lines = [
    `**Request Type:** ${payload.requestTypeName}`,
    `**Investor Name:** ${payload.investorName || "—"}`,
    `**Deal Name:** ${payload.dealName || "—"}`,
    `**Email:** ${payload.requestorEmail}`,
    `**Created By:** ${payload.requestorName}`,
    `**Submission Date:** ${payload.submittedAt}`,
    "",
    "**Notes:**",
    payload.notes || "—",
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
  const fieldIds = CUSTOM_FIELD_MAP[payload.requestType];
  if (fieldIds) {
    await Promise.all(
      Object.entries(fieldIds).map(([key, fieldId]) => {
        const rawValue = payload.customFields[key];
        if (!rawValue) return Promise.resolve();
        const value = key === "amountInvesting" ? parseCurrencyValue(rawValue) : rawValue;
        if (value === null) return Promise.resolve();
        return setCustomField(taskId, fieldId, value, token);
      })
    );
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
