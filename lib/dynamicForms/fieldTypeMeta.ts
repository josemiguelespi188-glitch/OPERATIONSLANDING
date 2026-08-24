import type { DynamicFieldType } from "./types";

export interface FieldTypeMeta {
  label: string;
  /** Short line shown under the label in the type picker. */
  hint: string;
  /** Fields that render as a single value input (vs. layout-only blocks). */
  hasOptions: boolean;
  hasPlaceholder: boolean;
  hasDefaultValue: boolean;
  /** Section divider / instructions / read-only info — no submitted value. */
  isLayoutOnly: boolean;
}

export const FIELD_TYPE_META: Record<DynamicFieldType, FieldTypeMeta> = {
  short_text: { label: "Short Text", hint: "A single line of text", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  long_text: { label: "Long Text", hint: "A multi-line text box", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  email: { label: "Email", hint: "A validated email address", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  phone: { label: "Phone Number", hint: "A validated phone number", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  number: { label: "Number", hint: "A plain numeric value", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  currency: { label: "Currency", hint: "A dollar amount", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  date: { label: "Date", hint: "A calendar date picker", hasOptions: false, hasPlaceholder: false, hasDefaultValue: true, isLayoutOnly: false },
  dropdown: { label: "Single-select", hint: "Choose one option from a list", hasOptions: true, hasPlaceholder: true, hasDefaultValue: false, isLayoutOnly: false },
  multi_select: { label: "Multi-select", hint: "Choose multiple options", hasOptions: true, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  checkbox: { label: "Checkbox", hint: "A single yes/no toggle", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  radio: { label: "Radio Button", hint: "Choose one, all options visible", hasOptions: true, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  file_upload: { label: "File Upload", hint: "Attach one or more files", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  section_divider: { label: "Section Divider", hint: "A heading that separates the form", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
  instructions: { label: "Instructions Block", hint: "Read-only guidance text", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
  readonly_info: { label: "Read-only Information", hint: "Static text with no input", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
};

export const FIELD_TYPE_OPTIONS: { value: DynamicFieldType; label: string }[] = Object.entries(
  FIELD_TYPE_META
).map(([value, meta]) => ({ value: value as DynamicFieldType, label: meta.label }));

/** Groups + ordering for the ClickUp-style "Add question" type picker. */
export const FIELD_TYPE_GROUPS: { group: string; types: DynamicFieldType[] }[] = [
  { group: "Text", types: ["short_text", "long_text"] },
  { group: "Contact info", types: ["email", "phone"] },
  { group: "Numbers & dates", types: ["number", "currency", "date"] },
  { group: "Choice", types: ["dropdown", "multi_select", "radio", "checkbox"] },
  { group: "Uploads", types: ["file_upload"] },
  { group: "Layout", types: ["section_divider", "instructions", "readonly_info"] },
];
