export type DynamicFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "currency"
  | "date"
  | "dropdown"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "file_upload"
  | "section_divider"
  | "instructions"
  | "readonly_info";

export interface DynamicFieldOption {
  id?: string;
  label: string;
  value: string;
}

export interface DynamicField {
  id?: string;
  fieldKey: string;
  fieldType: DynamicFieldType;
  label: string;
  description: string;
  placeholder: string;
  helpText: string;
  exampleText: string;
  isRequired: boolean;
  defaultValue: string;
  /** Raw JSON text as edited in the UI; parsed to an object on save. */
  validationRules: string;
  displayOrder: number;
  columnSpan: "half" | "full";
  options: DynamicFieldOption[];
}

export interface RequestTypeSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isLocked: boolean;
  usesDynamicForm: boolean;
  buttonLabel: string;
  icon: string | null;
  fieldCount: number;
}

export interface RequestTypeDetail extends RequestTypeSummary {
  fields: DynamicField[];
}

export function emptyField(displayOrder: number): DynamicField {
  return {
    fieldKey: "",
    fieldType: "short_text",
    label: "",
    description: "",
    placeholder: "",
    helpText: "",
    exampleText: "",
    isRequired: false,
    defaultValue: "",
    validationRules: "",
    displayOrder,
    columnSpan: "half",
    options: [],
  };
}
