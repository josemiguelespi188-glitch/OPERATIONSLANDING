import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper: "Enter the full legal name of the investor requesting the report.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    helper: "Enter the email address of the investor account this report should cover.",
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
    kind: "text",
    name: "offeringName",
    label: "What's the deal name invested in? (if applicable)",
    helper:
      "If the report should focus on a single deal, enter the exact offering name. Leave blank for an all-holdings report.",
    placeholder: "Enter text",
  },
  {
    kind: "select",
    name: "reportType",
    label: "What report do you need?",
    required: true,
    helper: "Select the type of report being requested.",
    placeholder: "Select the type of report being requested.",
    options: [
      "Distribution History",
      "Account Statement",
      "Tax Document Status",
      "Portfolio Summary",
      "Order History",
      "Other",
    ],
  },
  {
    kind: "text",
    name: "reportPeriod",
    label: "What time period should the report cover?",
    helper: "Enter the date range or period the report should reflect.",
    placeholder: "Enter text",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Additional details",
    helper: "Add any specific details about what should be included in the report.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper:
      "Enter your email address so you can track the status of this report request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
];

export const axiskeyReportRequestSpec: FormSpec = {
  title: "Request an AxisKey Report",
  descriptionParagraphs: [
    "Use this form to request a report on a specific investor account — such as a distribution history, account statement, or tax document status. This is client-facing: the investor or authorized signatory can request a report on their own account.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Investor Account Name", field: "investorAccountName" },
      { label: "Report Type", field: "reportType" },
      { label: "Report Period", field: "reportPeriod", skipIfEmpty: true },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Additional Details", field: "notes", skipIfEmpty: true },
    ],
    // No confirmed ClickUp custom field IDs yet — see
    // scripts/clickup/provision-forms.mjs, which creates them, and wire
    // the returned field IDs into CUSTOM_FIELD_MAP once run.
  },
};
