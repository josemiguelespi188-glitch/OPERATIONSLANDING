import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper: "Enter the full legal name of the investor whose information needs to be updated.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    helper: "Enter the email address currently on file for this investor.",
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
    helper: "If the update relates to a specific investment, enter the exact deal or offering name.",
    placeholder: "Enter text",
  },
  {
    kind: "select",
    name: "updateType",
    label: "What type of update is needed?",
    required: true,
    helper: "Select the category of information being updated.",
    placeholder: "Select the category of information being updated.",
    options: ["Contact Info", "Mailing Address", "Banking Details", "Tax Information", "Other"],
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Describe the update needed",
    required: true,
    helper: "Provide the specific new information (e.g., new address, new bank account/routing number, new phone number).",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper:
      "Enter your email address so you can track the status of this update request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "supportingDocumentation",
    label: "Supporting Documentation",
    helper: "If there is a signed update form, voided check, or W-9, please attach it here.",
  },
];

export const investorInformationUpdateSpec: FormSpec = {
  title: "Create an Investor Information Update Request on AxisKey",
  descriptionParagraphs: [
    "Use this form to request updates to an investor's records on file, such as contact information, mailing address, banking details, or tax information. The investor or authorized signatory must complete this form to initiate the change.",
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
      { label: "Offering Name", field: "offeringName", skipIfEmpty: true },
      { label: "Update Type", field: "updateType" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // Confirmed against the real "Investor Information Update" ClickUp
    // list (Aug 2026) — see CUSTOM_FIELD_MAP in lib/integrations/clickup.ts.
    customFields: [
      { key: "investorAccountName", field: "investorAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "updateType", field: "updateType" },
      { key: "notes", field: "notes" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
