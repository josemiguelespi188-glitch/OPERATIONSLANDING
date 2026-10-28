import {
  fetchClickUpTask,
  fetchListCustomFields,
  findTaskByCustomFieldValue,
  getCustomFieldTargets,
  getListIdForSlug,
} from "@/lib/integrations/clickup";
import type { DocumentField } from "./types";

export type ResolveResult =
  | { ok: true; taskId: string; values: Record<string, string> }
  | { ok: false; error: string };

/**
 * The live half of "Generate Document": given this request type's slug,
 * its saved mapping's fields, and an Order Number typed into the admin
 * UI, finds the matching task on that request type's ClickUp list and
 * decodes every mapped field's current value off it. Reviewed/edited-in-
 * ClickUp data wins -- this always reads the task fresh, never anything
 * cached from the original submission.
 *
 * A field with no clickUpFieldId at all (a fixed-text field, see
 * PdfField.fixedValue) is skipped here on purpose -- generatePdf() itself
 * always prefers fixedValue over anything in this resolved values map, so
 * there's nothing to look up for it.
 */
export async function resolveDocumentValuesFromClickUp(
  slug: string,
  fields: DocumentField[],
  orderNumber: string
): Promise<ResolveResult> {
  const listId = getListIdForSlug(slug);
  if (!listId) {
    return { ok: false, error: `No ClickUp list is configured for "${slug}" yet (CLICKUP_LIST_ID_MAP).` };
  }

  const orderNumberTarget = getCustomFieldTargets(slug).orderNumber?.[0];
  if (!orderNumberTarget) {
    return {
      ok: false,
      error: "Order Number isn't wired to a confirmed ClickUp field for this request type yet.",
    };
  }

  const trimmed = orderNumber.trim();
  if (!trimmed) return { ok: false, error: "Enter an order number." };

  const taskId = await findTaskByCustomFieldValue(listId, orderNumberTarget.id, trimmed);
  if (!taskId) {
    return { ok: false, error: `No request found with order number "${trimmed}".` };
  }

  const taskResult = await fetchClickUpTask(taskId);
  if (!taskResult.ok) {
    return { ok: false, error: taskResult.error };
  }

  const customFieldsOnTask =
    (taskResult.task.custom_fields as Record<string, unknown>[] | undefined) ?? [];
  const byFieldId = new Map(customFieldsOnTask.map((cf) => [cf.id as string, cf]));

  const clickUpFields = fields.filter((f) => f.clickUpFieldId);
  const listFieldDefs = clickUpFields.length ? await fetchListCustomFields(listId) : [];
  const listFieldDefById = new Map(listFieldDefs.map((f) => [f.id as string, f]));

  const values: Record<string, string> = {};
  for (const field of clickUpFields) {
    const fieldId = field.clickUpFieldId as string;
    values[field.id] = decodeValue(byFieldId.get(fieldId), listFieldDefById.get(fieldId));
  }

  return { ok: true, taskId, values };
}

/** Decodes a task's raw custom field value using ClickUp's own live field definition (type + type_config), never a hand-maintained kind table. */
function decodeValue(
  clickUpField: Record<string, unknown> | undefined,
  listFieldDef: Record<string, unknown> | undefined
): string {
  const raw = clickUpField?.value;
  if (raw === null || raw === undefined || raw === "") return "";

  const type = listFieldDef?.type as string | undefined;

  if (type === "checkbox") return raw ? "Yes" : "No";

  if (type === "drop_down") {
    const orderindex = typeof raw === "number" ? raw : Number(raw);
    const typeConfig = listFieldDef?.type_config as
      | { options?: { name: string; orderindex: number }[] }
      | undefined;
    const option = typeConfig?.options?.find((o) => o.orderindex === orderindex);
    return option?.name ?? String(raw);
  }

  if (type === "currency") {
    const num = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(num) ? `$${num.toLocaleString("en-US")}` : String(raw);
  }

  if (type === "number") {
    const num = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(num) ? String(num) : String(raw);
  }

  return String(raw);
}
