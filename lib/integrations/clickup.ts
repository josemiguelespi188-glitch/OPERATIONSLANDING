import type { AttachmentInput, RequestPayload } from "../types";

export interface ClickUpSyncResult {
  synced: boolean;
  taskId: string | null;
  error?: string;
  /**
   * Best-effort failures that happened after the task itself was created
   * successfully (an attachment-field link or a custom field write
   * ClickUp rejected) — these never fail the sync (the data is still
   * visible in the task description), but are worth surfacing instead of
   * disappearing silently.
   */
  warnings?: string[];
}

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

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
// "Requester Email" (9637efe7-f098-4ae7-8494-be2698a1617e) and "Client/
// Capital Raiser Email" (a655d17c-0108-470a-8d83-acf2a2abfeea) are two
// DIFFERENT ClickUp fields that both exist on almost every list below —
// the form spec calls for "Client/Capital Raiser Email" specifically
// (see AxisKey_Operations_Hub_Forms_Spec.md), so every requesterEmail
// entry here targets a655d17c, never 9637efe7. A Sept 2026 audit
// (scripts/clickup/audit-fields.mjs, read-only field enumeration) caught
// this and several other stale/incorrect field IDs below.
const CUSTOM_FIELD_MAP: Record<string, Record<string, ClickUpFieldTarget[]>> = {
  "title-transfer-request": {
    // Confirmed via scripts/clickup/audit-fields.mjs (Sept 2026) right
    // after the field was created in ClickUp — option names match the
    // form's dropdown exactly.
    typeOfTransfer: [
      {
        id: "c6057eeb-022e-498e-958c-de89c4faf37f",
        kind: "dropdown",
        options: {
          "Title Account Transfer": "a0acad8a-d8c3-41b0-9ae9-2953bc1d17f9",
          "Regular Transfer": "9c09c850-fa48-4e84-a90e-e03df54010ef",
          "Transfer Of Death": "42823763-a5a6-49c2-a5f4-bbac95c1a594",
          Donation: "f8623f3a-5dcd-4610-8b79-efad3f4cd614",
        },
      },
    ],
    currentAccountName: [{ id: "3026a4c9-b01c-41cb-ab92-87b2cf417ba1", kind: "text" }],
    newAccountName: [{ id: "0de379f0-b634-44ad-b5cc-ef75f46359ed", kind: "text" }],
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    // This list has two distinct fields both literally named "Investor
    // Email" (fdf10d51... and 6429a23e...) — using 6429a23e since that's
    // the one shared consistently across every other list. Consider
    // deleting the duplicate (fdf10d51) in ClickUp to avoid future mixups.
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
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
    // The user restored this list's "Note" field (as Long Text, matching
    // the shared 42b9ef7f... field also used on several other lists
    // below) after it had gone missing.
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
    issuerApprovedRedemption: [{ id: "4fdc8130-8d98-4172-8003-7f3e39ff5c5a", kind: "checkbox" }],
  },
  "ira-funding-request": {
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    custodian: [{ id: "f2d63342-eb0e-48f8-a930-4c183fa65284", kind: "text" }],
    amountInvesting: [{ id: "5bbae178-213c-4daf-9af2-becc105f0bbd", kind: "number" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    // "CC Email" is its own field here, distinct from Requester Email/
    // Client-Capital Raiser Email used elsewhere — matches this form's
    // own spec row ("CC Email"), not the other forms'.
    ccEmail: [{ id: "715f4b75-677f-40ab-98e7-42c21bcb4a02", kind: "text" }],
  },
  "refund-request": {
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    reasonForRefund: [{ id: "cbe6e8ba-b3d0-4d15-891a-6135dc0fa5d2", kind: "text" }],
    refundAmount: [{ id: "16bbdf7a-3426-45db-bdb2-d027a4e88173", kind: "number" }],
  },
  "side-letter-request": {
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    // "Offering Name" is now a single field shared across every list
    // (3a84a910...) — the separate c438a21a... field this used to point
    // at no longer exists (consolidated in ClickUp at some point).
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    // This list actually has two fields both named "Note" (one Long
    // Text, one Short Text) — using the Long Text one (42b9ef7f...,
    // shared with several other lists) per instruction.
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
    // The ClickUp dropdown already existed with slightly different option
    // wording than the form ("Double Bonus Payment" / "Higher Interest
    // Rate" vs the form's "Double Bonus Months" / "Additional Annualized
    // Return") — mapped by matching intent below. Rename either side in
    // ClickUp/the form if you want them to read identically.
    sideLetterType: [
      {
        id: "c09fee99-4a44-4a86-9850-a882229f1596",
        kind: "dropdown",
        options: {
          "Double Bonus Months": "ee707490-a583-4c1e-ae5e-1aaf4b4af8ac",
          "Additional Annualized Return": "d68e77ca-1bc7-4f37-8ff2-c716922dbfb1",
          "Fee Waiver": "07bb27a8-a845-423b-9cc3-6dd2c66cf43d",
          Other: "6fce4750-d8ad-4e8b-b588-a685f3fd130c",
        },
      },
    ],
  },
  "investor-information-update": {
    // "Offering Name" is now a single field shared across every list
    // (3a84a910...) — the separate c438a21a... field this used to point
    // at no longer exists (consolidated in ClickUp at some point).
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    orderNumber: [{ id: "70257f39-e3a9-4c45-88bf-e5c5677ccc03", kind: "text" }],
    // This list's own "Information to Update" field, distinct from the
    // "Note" field used on side-letter-request.
    notes: [{ id: "49e8aa99-c731-42bd-b27d-dd250eb41f0f", kind: "text" }],
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
  },
  "account-maintenance-request": {
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    // The user restored this list's "Note" field (as Long Text, matching
    // the shared 42b9ef7f... field also used on several other lists).
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    // This list also has two fields literally named "Investor Email" —
    // using 6429a23e since that's the one shared consistently across
    // every other list (see the title-transfer-request comment above).
    investorEmail: [{ id: "6429a23e-370b-40f8-ac77-f8273b2b7787", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
  },
  "document-request": {
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
    // The user restored this list's "Note" field (as Long Text, matching
    // the shared 42b9ef7f... field also used on several other lists).
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    documentNeeded: [
      {
        id: "86e46ade-ece1-481e-9361-66d905e1cdc3",
        kind: "dropdown",
        options: {
          "Government ID": "8dfda3e5-946c-49f4-afff-fec726c2d3ba",
          "Articles of Incorporation": "a99fa563-1d3a-4f33-a70e-1f4a2335970f",
          "Trust Agreement": "e4d70b69-f190-4350-8ee2-acbce0a0bb2c",
          "Accreditation Letter": "306a8d59-bdb4-4207-90e5-503b4d693622",
          "Custodian Letter": "91058048-8bb2-414d-9313-c23c35e98440",
          "Operating Agreement": "dda80410-8c24-4849-9429-82706d1c0711",
          Other: "dd69cd20-e3e7-45c3-9d65-f4cb3bc1b76a",
        },
      },
    ],
  },
  "axiskey-report-request": {
    // "Offering Name" is now a single field shared across every list
    // (3a84a910...) — the separate c438a21a... field this used to point
    // at no longer exists (consolidated in ClickUp at some point).
    offeringName: [{ id: "3a84a910-2a20-4c12-984f-d3e89926550a", kind: "text" }],
    // The form's "dateRange" field maps to ClickUp's own "Date Range"
    // field (not "Report Period", an older unrelated field that's still
    // on this list but no longer used).
    dateRange: [{ id: "7ed0cab2-f868-4c7e-814a-94daeb040a60", kind: "text" }],
    // The user restored this list's "Note" field (as Long Text, matching
    // the shared 42b9ef7f... field also used on several other lists).
    notes: [{ id: "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f", kind: "text" }],
    requesterEmail: [{ id: "a655d17c-0108-470a-8d83-acf2a2abfeea", kind: "text" }],
    // The dropdown with the current option set is literally named
    // "Report Type-" (trailing hyphen) in ClickUp, not "Report Type" —
    // an old "Report Type" field with the outdated options (Distribution
    // History, etc.) also still exists on this list, unused now. Worth
    // renaming "Report Type-" to "Report Type" and deleting the old one
    // in ClickUp to avoid future confusion.
    reportType: [
      {
        id: "8c27d365-14a3-4a67-bfb9-f03a442663fd",
        kind: "dropdown",
        options: {
          "All Investors Accounts": "a1a41738-b9fa-4128-b9c0-236f09791160",
          "All Active Orders": "1f8e6b0e-f8f0-482f-ad91-4fe4ffd870e5",
          "All Completed Orders": "6bd05723-cc5e-448e-b67c-f49a545cf583",
          "Pending Orders": "94606a44-4aaf-4e8a-8ec4-7c92edba9a06",
          "Orders Report": "eb611c2f-d6fa-4458-b490-c5a96d6e7459",
          "Client Investment Report": "c7d517de-e5b9-4ac1-bfb3-8825fb6ae6af",
          "Cap Table Report": "12027e90-3455-490b-9b7e-558bcfd4e1f7",
          "Activity Summary Report": "d7b435eb-fc36-445c-9221-04b698bf7068",
          Other: "1a43ab12-0613-4136-9dbb-5a2bcc506a4f",
        },
      },
    ],
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
  "refund-request": {
    refundDocumentation: "3d082ed6-621a-4546-bff8-315544c7bc05", // "Additional File"
  },
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
 * The ClickUp task name must be the literal name field value — no label
 * prefix, no " | offering" suffix. Every form's submissionMapping sets
 * investorNameField to the relevant person's name (see each
 * lib/formSpecs/<slug>.ts), so payload.investorName already carries it
 * for all 9 request types.
 *
 * This used to compose "<Label> | <requestor> | <offering>" for 6 of the
 * 9 types, which broke the ClickUp automations that send status emails
 * off of the task name (they expect it to be just the person's name).
 */
function buildTaskName(payload: RequestPayload): string {
  return payload.investorName || payload.requestorName;
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

  const warnings: string[] = [];

  // Resolved up front and sent in the *same* create-task call below,
  // instead of as follow-up writes after the task exists. ClickUp's "task
  // created" automations (e.g. the notification emails the ops team
  // built) fire the instant the task is created and only see whatever
  // was in that one payload — any field set via a separate call afterward
  // arrives too late for that automation to read, even though it shows up
  // correctly moments later in the task itself. Including everything
  // ClickUp allows at creation time (every custom field except
  // attachments, which can only be linked after the task/file both
  // exist) closes that race for every field except attachments.
  const fieldTargets = CUSTOM_FIELD_MAP[payload.requestType];
  const customFieldsPayload: { id: string; value: unknown }[] = [];
  if (fieldTargets) {
    for (const [key, targets] of Object.entries(fieldTargets)) {
      const rawValue = payload.customFields[key];
      if (!rawValue) continue;
      for (const target of targets) {
        const value = resolveFieldValue(target, rawValue);
        if (value === null) continue;
        customFieldsPayload.push({ id: target.id, value });
      }
    }
  }

  const taskName = buildTaskName(payload);
  const taskDescription = buildTaskDescription(payload);

  let taskId: string;
  let fieldsIncludedAtCreation = true;
  try {
    let response = await fetch(`${CLICKUP_API_BASE}/list/${listId}/task`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: taskName,
        description: taskDescription,
        custom_fields: customFieldsPayload,
      }),
    });

    // If ClickUp rejects the combined payload (e.g. one field's value in
    // an unexpected shape), don't lose the whole request over it — retry
    // bare and fall back to writing those fields as follow-up calls below,
    // same as before this optimization existed.
    if (!response.ok && customFieldsPayload.length > 0) {
      const firstAttemptBody = await response.text().catch(() => "");
      warnings.push(
        `Task creation with custom fields included was rejected (${response.status}: ${firstAttemptBody.slice(0, 200)}) — retried without them.`
      );
      fieldsIncludedAtCreation = false;
      response = await fetch(`${CLICKUP_API_BASE}/list/${listId}/task`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: taskName, description: taskDescription }),
      });
    }

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

  // Only needed if the combined create-with-fields attempt above failed
  // and had to fall back to a bare task — apply the same fields as
  // individual follow-up writes so the data isn't lost, just later than
  // ideal (any "task created" automation won't see them in time either
  // way, same as before this optimization existed).
  if (!fieldsIncludedAtCreation && customFieldsPayload.length > 0) {
    await Promise.all(
      customFieldsPayload.map(async ({ id, value }) => {
        const result = await setCustomField(taskId, id, value, token);
        if (!result.ok) {
          warnings.push(`Failed to write custom field ${id} on fallback: ${result.error}`);
        }
      })
    );
  }

  // Best-effort: attach the actual files when the API allows it, and link
  // them into their matching attachment-type custom field. Unlike the
  // custom fields above, a file can only be uploaded once the task (and
  // the file's own bytes) exist, so this unavoidably happens after
  // creation — any "task created" automation still won't see these in
  // time. A failure here never fails the sync — the file URLs are
  // already in the task description as a fallback per the attachment
  // requirements.
  const attachmentFieldIds = ATTACHMENT_FIELD_MAP[payload.requestType] ?? {};
  await Promise.all(
    payload.attachments.map(async (attachment) => {
      const attachmentId = await attachTaskFile(taskId, attachment, token);
      if (!attachmentId) {
        warnings.push(`Failed to upload "${attachment.fileName}" as a ClickUp attachment.`);
        return;
      }
      const fieldId = attachment.fieldKey ? attachmentFieldIds[attachment.fieldKey] : undefined;
      if (fieldId) {
        const result = await setCustomField(taskId, fieldId, { add: [attachmentId] }, token);
        if (!result.ok) {
          warnings.push(
            `Uploaded "${attachment.fileName}" but couldn't link it to its attachment field (${attachment.fieldKey}): ${result.error}`
          );
        }
      }
    })
  );

  if (warnings.length > 0) {
    console.error(`ClickUp sync warnings for task ${taskId}:`, warnings);
  }

  return { synced: true, taskId, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Sets one custom field's value. Returns whether ClickUp actually
 * accepted it — the caller decides what to do with a failure (this never
 * throws, since a failure here shouldn't fail the overall sync, but it
 * must be reported rather than silently dropped: fetch() only rejects on
 * a network-level failure, never on a non-2xx response, so callers that
 * don't check the result here would never learn a write was rejected).
 */
async function setCustomField(
  taskId: string,
  fieldId: string,
  value: unknown,
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${CLICKUP_API_BASE}/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `${response.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown network error.",
    };
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
