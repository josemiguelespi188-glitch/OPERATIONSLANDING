import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is requesting this report?",
    required: true,
    helper: "Enter the full name of the person requesting the report.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "select",
    name: "reportType",
    label: "What report is being requested?",
    required: true,
    helper: "Select the type of report needed.",
    placeholder: "Select the type of report needed.",
    options: [
      "All Investors Accounts",
      "All Active Orders",
      "All Completed Orders",
      "Pending Orders",
      "Orders Report",
      "Client Investment Report",
      "Cap Table Report",
      "Activity Summary Report",
      "Other",
    ],
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering this report is for?",
    required: true,
    helper: "Enter the exact name of the offering, if the report is specific to one. Leave blank for a platform-wide report.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "text",
    name: "dateRange",
    label: "What date range should the report cover?",
    required: true,
    helper: "Enter the start and end date for the report, if applicable.",
    placeholder: "01/01/2026 - 06/30/2026",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Please provide additional details",
    required: true,
    helper: "Add any additional context on what should be included in the report.",
    placeholder: "Needs to include investor contact info and total committed capital per investor.",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    required: true,
    helper:
      "Enter your email address so you can track the status of this report request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
];

export const axiskeyReportRequestSpec: FormSpec = {
  title: "Request an AxisKey Report",
  descriptionParagraphs: [
    "This request is used to generate a report from AxisKey covering investors, orders, or overall account activity. Reports are not limited to a single investor: they can be requested at the client, offering, or platform-wide level. The client or Capital Raiser must complete this form to initiate the report.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Report Type", field: "reportType" },
      { label: "Date Range", field: "dateRange" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // All confirmed via scripts/clickup/audit-fields.mjs (Sept 2026) —
    // see CUSTOM_FIELD_MAP in lib/integrations/clickup.ts. reportType
    // maps to a field ClickUp confusingly named "Report Type-" (trailing
    // hyphen); dateRange maps to ClickUp's own "Date Range" field, not
    // the older "Report Period" field this used to point at.
    customFields: [
      { key: "offeringName", field: "offeringName" },
      { key: "dateRange", field: "dateRange" },
      { key: "notes", field: "notes" },
      { key: "requesterEmail", field: "requesterEmail" },
      { key: "reportType", field: "reportType" },
    ],
  },
};
