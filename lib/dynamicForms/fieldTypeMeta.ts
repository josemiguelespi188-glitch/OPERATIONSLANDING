import type { DynamicFieldType } from "./types";

export interface FieldTypeMeta {
  label: string;
  /** Fields that render as a single value input (vs. layout-only blocks). */
  hasOptions: boolean;
  hasPlaceholder: boolean;
  hasDefaultValue: boolean;
  /** Section divider / instructions / read-only info — no submitted value. */
  isLayoutOnly: boolean;
}

export const FIELD_TYPE_META: Record<DynamicFieldType, FieldTypeMeta> = {
  short_text: { label: "Short Text", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  long_text: { label: "Long Text", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  email: { label: "Email", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  phone: { label: "Phone Number", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  number: { label: "Number", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  currency: { label: "Currency", hasOptions: false, hasPlaceholder: true, hasDefaultValue: true, isLayoutOnly: false },
  date: { label: "Date", hasOptions: false, hasPlaceholder: false, hasDefaultValue: true, isLayoutOnly: false },
  dropdown: { label: "Dropdown", hasOptions: true, hasPlaceholder: true, hasDefaultValue: false, isLayoutOnly: false },
  multi_select: { label: "Multi Select", hasOptions: true, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  checkbox: { label: "Checkbox", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  radio: { label: "Radio Button", hasOptions: true, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  file_upload: { label: "File Upload", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: false },
  section_divider: { label: "Section Divider", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
  instructions: { label: "Instructions Block", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
  readonly_info: { label: "Read-only Information", hasOptions: false, hasPlaceholder: false, hasDefaultValue: false, isLayoutOnly: true },
};

export const FIELD_TYPE_OPTIONS: { value: DynamicFieldType; label: string }[] = Object.entries(
  FIELD_TYPE_META
).map(([value, meta]) => ({ value: value as DynamicFieldType, label: meta.label }));
