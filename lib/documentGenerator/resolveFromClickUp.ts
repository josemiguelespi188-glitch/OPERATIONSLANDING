import { FORM_SPECS } from "@/lib/formSpecs";
import {
  fetchClickUpTask,
  fetchListCustomFields,
  findTaskByCustomFieldValue,
  getCustomFieldTargets,
  getListIdForSlug,
  type ClickUpFieldTarget,
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

  const targets = getCustomFieldTargets(slug);
  const orderNumberTarget = targets.orderNumber?.[0];
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

  // Only fetch the list's live field definitions (needed to decode a
  // dropdown's stored orderindex back to display text) when at least one
  // mapped field actually needs it -- an extra ClickUp call that would
  // otherwise be wasted on every generate click.
  const needsListFieldDefs = fields.some((f) => targets[f.customFieldKey]?.[0]?.kind === "dropdown");
  const listFieldDefs = needsListFieldDefs ? await fetchListCustomFields(listId) : [];
  const listFieldDefById = new Map(listFieldDefs.map((f) => [f.id as string, f]));

  const values: Record<string, string> = {};
  for (const field of fields) {
    const target = targets[field.customFieldKey]?.[0];
    // A mapping can reference a key that was later unconfirmed/removed
    // from CUSTOM_FIELD_MAP -- skip rather than guess at a value.
    if (!target) continue;
    values[field.id] = decodeValue(
      target,
      byFieldId.get(target.id),
      listFieldDefById.get(target.id),
      slug,
      field.customFieldKey
    );
  }

  return { ok: true, taskId, values };
}

function decodeValue(
  target: ClickUpFieldTarget,
  clickUpField: Record<string, unknown> | undefined,
  listFieldDef: Record<string, unknown> | undefined,
  slug: string,
  customFieldKey: string
): string {
  const raw = clickUpField?.value;
  if (raw === null || raw === undefined || raw === "") return "";

  if (target.kind === "checkbox") return raw ? "Yes" : "No";

  if (target.kind === "dropdown") {
    const orderindex = typeof raw === "number" ? raw : Number(raw);
    const typeConfig = listFieldDef?.type_config as
      | { options?: { name: string; orderindex: number }[] }
      | undefined;
    const option = typeConfig?.options?.find((o) => o.orderindex === orderindex);
    return option?.name ?? String(raw);
  }

  if (target.kind === "number") {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) return String(raw);
    return formSpecFieldKind(slug, customFieldKey) === "currency" ? `$${num.toLocaleString("en-US")}` : String(num);
  }

  return String(raw);
}

/** The originating form field's own `kind` (e.g. "currency" vs plain "number"), for display formatting only. */
function formSpecFieldKind(slug: string, customFieldKey: string): string | undefined {
  const spec = FORM_SPECS[slug as keyof typeof FORM_SPECS];
  if (!spec) return undefined;
  const entry = spec.submissionMapping.customFields?.find((c) => c.key === customFieldKey);
  if (!entry) return undefined;
  return spec.fields.find((f) => f.name === entry.field)?.kind;
}
