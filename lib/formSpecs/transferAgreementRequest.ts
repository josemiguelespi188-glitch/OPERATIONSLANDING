import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor transferring the investment?",
    required: true,
    helper: "Enter the full legal name of the investor transferring the investment.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account associated with this transfer.",
    placeholder: "michael.dawson@email.com",
  },
  {
    kind: "text",
    name: "buyerName",
    label: "Who is the buyer receiving the investment?",
    required: true,
    helper: "Enter the full legal name of the buyer this investment is being transferred to.",
    placeholder: "Sarah Collins",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    required: true,
    helper:
      "Enter the order number associated with the investment being transferred. You can find this on the AxisKey portal under the investor's order.",
    placeholder: "10234",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering where the transfer is being requested.",
    placeholder: "Northgate Capital Fund",
  },
  {
    kind: "text",
    name: "investorAccountName",
    label: "What is the account name on file?",
    required: true,
    helper: "Enter the name currently registered on the AxisKey portal for this investment order.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "currency",
    name: "transferAmount",
    label: "How much is being transferred?",
    required: true,
    helper: "Enter the exact amount of the investment being transferred to the buyer, in USD.",
    placeholder: "25,000",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Why is this transfer being requested?",
    helper: "Explain the reason for the transfer agreement request and any additional details relevant to processing it.",
    placeholder: "Investor transferring their full interest to a new buyer.",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    required: true,
    helper:
      "Enter your email address so you can track the status of this transfer agreement request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
  {
    kind: "file",
    name: "transferAgreement",
    label: "Do you have supporting documentation to attach?",
    helper: "If there is a signed transfer agreement or authorization letter, please attach it here.",
  },
];

export const transferAgreementRequestSpec: FormSpec = {
  title: "Create a Transfer Agreement Request on AxisKey",
  descriptionParagraphs: [
    "A Transfer Agreement moves all or part of an investor's existing investment order to a new buyer, formalizing the change of ownership. The investment itself stays the same; only the owner of record changes. The investor or authorized signatory must complete this form to initiate the transfer, including the buyer's details.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Buyer Name", field: "buyerName" },
      { label: "Investor Account Name", field: "investorAccountName" },
      { label: "Order Number", field: "orderNumber" },
      { label: "Transfer Amount (USD)", field: "transferAmount" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes", skipIfEmpty: true },
    ],
    // No CUSTOM_FIELD_MAP entry exists yet for this brand-new request
    // type -- a slug with no key there simply skips custom-field sync
    // (data still lands in the task description via buildTaskDescription)
    // until the ClickUp list exists and its field IDs are confirmed. See
    // CLAUDE.md's "Transfer Agreement Request" section.
    customFields: [
      { key: "buyerName", field: "buyerName" },
      { key: "investorAccountName", field: "investorAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "transferAmount", field: "transferAmount" },
      { key: "notes", field: "notes" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
