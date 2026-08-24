import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper: "Enter the full legal name of the investor requesting the side letter.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    helper: "Enter the email address of the investor account associated with this side letter.",
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the deal name invested in?",
    required: true,
    helper: "Enter the exact name of the deal or offering the side letter applies to.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    helper: "If the side letter is associated with a specific order, enter the corresponding order number.",
    placeholder: "Enter text",
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
    kind: "textarea",
    name: "sideLetterTerms",
    label: "What terms is the investor requesting?",
    required: true,
    helper: "Describe the specific terms, rights, or conditions being requested in the side letter.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "checkbox",
    name: "issuerApprovedSideLetter",
    label: "Issuer Approved Side Letter",
    helper: "Check this box if the issuer has already approved the side letter terms.",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Note",
    helper: "Add any additional context relevant to processing this request.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper:
      "Enter your email address so you can track the status of this side letter request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "sideLetterDocument",
    label: "Side Letter Document",
    helper: "If there is a draft or signed side letter, please attach it here.",
  },
];

export const sideLetterRequestSpec: FormSpec = {
  title: "Create a Side Letter Request on AxisKey",
  descriptionParagraphs: [
    "A side letter is a supplemental agreement that grants an investor specific terms, rights, or conditions outside the standard subscription agreement (e.g., fee adjustments, co-investment rights, reporting rights). The investor or authorized signatory must complete this form to initiate the request.",
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
      { label: "Order Number", field: "orderNumber" },
      { label: "Side Letter Terms", field: "sideLetterTerms" },
      { label: "Issuer Approved Side Letter", field: "issuerApprovedSideLetter", skipIfEmpty: true },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes", skipIfEmpty: true },
    ],
    // No confirmed ClickUp custom field IDs yet — see
    // scripts/clickup/provision-forms.mjs, which creates them, and wire
    // the returned field IDs into CUSTOM_FIELD_MAP once run.
  },
};
