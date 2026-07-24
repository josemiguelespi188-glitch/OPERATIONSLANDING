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

  // Best-effort: attach the actual files when the API allows it. A failure
  // here never fails the sync — the file URLs are already in the task
  // description as a fallback per the attachment requirements.
  await Promise.all(
    payload.attachments.map((attachment) =>
      attachTaskFile(taskId, attachment, token)
    )
  );

  return { synced: true, taskId };
}

async function attachTaskFile(
  taskId: string,
  attachment: AttachmentInput,
  token: string
): Promise<void> {
  try {
    const fileResponse = await fetch(attachment.fileUrl);
    if (!fileResponse.ok) return;
    const blob = await fileResponse.blob();

    const form = new FormData();
    form.append("attachment", blob, attachment.fileName);

    await fetch(`${CLICKUP_API_BASE}/task/${taskId}/attachment`, {
      method: "POST",
      headers: { Authorization: token },
      body: form,
    });
  } catch {
    // Non-fatal — the file URL is already in the task description.
  }
}
