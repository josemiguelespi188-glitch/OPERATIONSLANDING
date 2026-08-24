import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper: "Enter the full legal name of the investor associated with this request.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    helper: "Enter the email address of the investor account associated with this request.",
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor Account Name",
    required: true,
    helper: "Enter the name currently registered on the AxisKey portal for this investor.",
    placeholder: "Enter text",
  },
  {
    kind: "select",
    name: "maintenanceType",
    label: "What type of maintenance is needed?",
    required: true,
    helper: "Select the category that best describes this request.",
    placeholder: "Select the category that best describes this request.",
    options: [
      "Portal Access Issue",
      "Duplicate Account Merge",
      "Account Deactivation",
      "Login Reset",
      "Other",
    ],
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Describe the issue or request",
    required: true,
    helper: "Provide details on what needs to be fixed or maintained.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper: "Enter your email address so you can track the status of this request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "supportingDocumentation",
    label: "Supporting Documentation",
    helper: "Attach any relevant screenshots or documentation here.",
  },
];

export const accountMaintenanceRequestSpec: FormSpec = {
  title: "Create an Account Maintenance Request on AxisKey",
  descriptionParagraphs: [
    "Use this form for general account maintenance needs that aren't covered by the other standard forms, such as portal access issues, merging duplicate investor accounts, or deactivating an account.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Investor Account Name", field: "investorAccountName" },
      { label: "Maintenance Type", field: "maintenanceType" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // Confirmed against the real "Account Maintenance Request" ClickUp
    // list (Aug 2026) — see CUSTOM_FIELD_MAP in lib/integrations/clickup.ts.
    customFields: [
      { key: "investorAccountName", field: "investorAccountName" },
      { key: "maintenanceType", field: "maintenanceType" },
      { key: "notes", field: "notes" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
