/**
 * Bridges the two field representations in the app:
 *  - FieldConfig (components/axiskey-forms/FormShell) — what the public,
 *    code-driven forms actually render.
 *  - DynamicField (lib/dynamicForms/types) — what the admin Form Builder
 *    edits and what's persisted to `request_fields`.
 *
 * This is what makes a "locked" (code-driven) form's copy editable from
 * the admin: a locked form's base structure (field keys, types, order,
 * ClickUp mapping) always comes from its FormSpec in lib/formSpecs — never
 * from the database — but its label/description/placeholder/required text
 * can be overridden per field key, and brand-new fields can be appended.
 * Overrides/extra fields are matched and merged the same way for both the
 * public page (mergePublicFields) and the admin editor (mergeAdminFields),
 * so what the admin sees is what actually renders.
 */
import type { FieldConfig, SubmissionMapping } from "@/components/axiskey-forms/FormShell";
import type { DynamicField, DynamicFieldType } from "./types";

export interface FormSpec {
  title: string;
  descriptionParagraphs: string[];
  fields: FieldConfig[];
  submissionMapping: SubmissionMapping;
}

/** FieldConfig kinds a DynamicFieldType can round-trip through. Anything
 *  else (multi_select, radio, section_divider, instructions, readonly_info)
 *  has no FormShell equivalent and is skipped when rendering the public
 *  form — the admin's type picker is restricted to this set for locked
 *  forms so an admin can never create a field that silently fails to
 *  render. */
const DYNAMIC_TO_CONFIG_KIND: Partial<Record<DynamicFieldType, FieldConfig["kind"]>> = {
  short_text: "text",
  long_text: "textarea",
  email: "email",
  phone: "text",
  number: "number",
  currency: "currency",
  date: "date",
  dropdown: "select",
  checkbox: "checkbox",
  file_upload: "file",
};

const CONFIG_KIND_TO_DYNAMIC: Record<FieldConfig["kind"], DynamicFieldType> = {
  text: "short_text",
  textarea: "long_text",
  email: "email",
  number: "number",
  currency: "currency",
  date: "date",
  select: "dropdown",
  checkbox: "checkbox",
  file: "file_upload",
};

/** DynamicFieldType options the "Add question" picker offers when editing
 *  a locked form — every type FormShell can actually render. */
export const LOCKED_FORM_FIELD_TYPES: DynamicFieldType[] = Object.keys(
  DYNAMIC_TO_CONFIG_KIND
) as DynamicFieldType[];

function toDynamicField(field: FieldConfig, order: number): DynamicField {
  return {
    fieldKey: field.name,
    fieldType: CONFIG_KIND_TO_DYNAMIC[field.kind],
    label: field.label,
    description: "helper" in field ? field.helper ?? "" : "",
    placeholder: "placeholder" in field ? field.placeholder ?? "" : "",
    helpText: "",
    exampleText: "",
    isRequired: !!field.required,
    defaultValue: "",
    validationRules: "",
    displayOrder: order,
    columnSpan: field.fullWidth ? "full" : "half",
    options: field.kind === "select" ? field.options.map((o) => ({ label: o, value: o })) : [],
  };
}

/** Applies a DB override onto a spec's base FieldConfig — only copy and
 *  required-ness change; kind/name (and therefore ClickUp mapping) always
 *  stay whatever the code defines. */
function applyOverride(base: FieldConfig, override: DynamicField): FieldConfig {
  const label = override.label.trim() || base.label;
  const required = override.isRequired;
  const fullWidth = override.columnSpan === "full" ? true : base.fullWidth;

  if (base.kind === "checkbox") {
    return { ...base, label, required, fullWidth, helper: override.description || base.helper };
  }
  if (base.kind === "file") {
    return { ...base, label, required, fullWidth, helper: override.description || base.helper };
  }
  return {
    ...base,
    label,
    required,
    fullWidth,
    helper: override.description || base.helper,
    placeholder: override.placeholder.trim() || base.placeholder,
  } as FieldConfig;
}

/** Converts one admin-authored "extra" DynamicField (a field the code
 *  doesn't define) into a renderable FieldConfig. Returns null for a type
 *  FormShell can't render (layout-only blocks, multi-select, radio) — the
 *  admin UI shouldn't offer these for locked forms, but skip defensively
 *  rather than crash the public page if one ever ends up saved. */
function extraFieldToConfig(field: DynamicField): FieldConfig | null {
  const kind = DYNAMIC_TO_CONFIG_KIND[field.fieldType];
  if (!kind) return null;

  const shared = {
    name: field.fieldKey,
    label: field.label || field.fieldKey,
    required: field.isRequired,
    fullWidth: field.columnSpan === "full",
  };

  if (kind === "checkbox") {
    return { kind, ...shared, helper: field.description || undefined };
  }
  if (kind === "file") {
    return { kind, ...shared, helper: field.description || undefined };
  }
  if (kind === "select") {
    return {
      kind,
      ...shared,
      helper: field.description || undefined,
      placeholder: field.placeholder || "Select an option",
      options: field.options.length > 0 ? field.options.map((o) => o.label) : ["Option 1"],
    };
  }
  return {
    kind,
    ...shared,
    helper: field.description || undefined,
    placeholder: field.placeholder || "Enter text",
  } as FieldConfig;
}

/** Merges DB rows onto a locked form's spec for the *public* page: base
 *  fields keep their code order and get copy overrides applied; rows with
 *  no matching code field key are appended as new questions, and flow into
 *  ClickUp via the task notes (they have no confirmed custom field yet). */
export function mergePublicFields(
  spec: FormSpec,
  dbFields: DynamicField[]
): { fields: FieldConfig[]; submissionMapping: SubmissionMapping } {
  const dbByKey = new Map(dbFields.map((f) => [f.fieldKey, f]));
  const codeKeys = new Set(spec.fields.map((f) => f.name));

  const fields = spec.fields.map((base) => {
    const override = dbByKey.get(base.name);
    return override ? applyOverride(base, override) : base;
  });

  const extraDbFields = dbFields.filter((f) => !codeKeys.has(f.fieldKey));
  const extraNotesFields: SubmissionMapping["notesFields"] = [];
  for (const extra of extraDbFields) {
    const config = extraFieldToConfig(extra);
    if (!config) continue;
    fields.push(config);
    extraNotesFields.push({
      label: extra.label || extra.fieldKey,
      field: extra.fieldKey,
      skipIfEmpty: !extra.isRequired,
    });
  }

  return {
    fields,
    submissionMapping:
      extraNotesFields.length > 0
        ? { ...spec.submissionMapping, notesFields: [...spec.submissionMapping.notesFields, ...extraNotesFields] }
        : spec.submissionMapping,
  };
}

/** Merges DB rows onto a locked form's spec for the *admin editor*:
 *  produces the full editable DynamicField list, code fields first (marked
 *  isCodeManaged so the UI can lock their key/type), then any extra ones. */
export function mergeAdminFields(
  spec: FormSpec,
  dbFields: DynamicField[]
): (DynamicField & { isCodeManaged: boolean })[] {
  const dbByKey = new Map(dbFields.map((f) => [f.fieldKey, f]));
  const codeKeys = new Set(spec.fields.map((f) => f.name));

  const codeRows = spec.fields.map((base, i) => {
    const override = dbByKey.get(base.name);
    const seeded = toDynamicField(base, i);
    return {
      ...seeded,
      ...(override
        ? {
            label: override.label,
            description: override.description,
            placeholder: override.placeholder,
            isRequired: override.isRequired,
            columnSpan: override.columnSpan,
          }
        : {}),
      // Key/type/order/options always come from code — never overridable.
      fieldKey: seeded.fieldKey,
      fieldType: seeded.fieldType,
      displayOrder: i,
      options: seeded.options,
      isCodeManaged: true,
    };
  });

  const extraRows = dbFields
    .filter((f) => !codeKeys.has(f.fieldKey))
    .map((f, i) => ({ ...f, displayOrder: spec.fields.length + i, isCodeManaged: false }));

  return [...codeRows, ...extraRows];
}

/** field_key -> the DynamicFieldType that field is coded as. Used server-
 *  side (the fields PUT route) to reject a save that tries to change the
 *  type of a code-defined field — the type is load-bearing for ClickUp
 *  mapping and FormShell rendering, so it can never come from the DB. */
export function codeFieldTypesByKey(spec: FormSpec): Record<string, DynamicFieldType> {
  const map: Record<string, DynamicFieldType> = {};
  for (const field of spec.fields) {
    map[field.name] = CONFIG_KIND_TO_DYNAMIC[field.kind];
  }
  return map;
}
