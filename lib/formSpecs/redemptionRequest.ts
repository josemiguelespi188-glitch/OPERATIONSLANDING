import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor requesting the redemption?",
    required: true,
    helper: "Enter the full legal name of the investor requesting the redemption.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account associated with this redemption.",
    placeholder: "michael.dawson@email.com",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    required: true,
    helper:
      "Enter the order number associated with the investment being redeemed. You can find this on the AxisKey portal under the investor's order.",
    placeholder: "10234",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering where the redemption is being requested.",
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
    kind: "select",
    name: "redemptionType",
    label: "Is this a full or partial redemption?",
    required: true,
    helper: "Select whether this is a full or partial redemption of the investment.",
    placeholder: "Select whether this is a full or partial redemption.",
    options: ["Full", "Partial"],
  },
  {
    kind: "currency",
    name: "redemptionAmount",
    label: "How much is being redeemed?",
    required: true,
    helper: "If partial, enter the exact amount to be redeemed in USD.",
    placeholder: "25,000",
  },
  {
    kind: "checkbox",
    name: "issuerApprovedRedemption",
    label: "Has the issuer already approved this redemption?",
    helper: "Check this box if the issuer has already approved the redemption.",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Why is this redemption being requested?",
    helper: "Explain the reason for the redemption request and any additional details relevant to processing it.",
    placeholder: "Investor requesting partial redemption due to personal liquidity needs.",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    required: true,
    helper:
      "Enter your email address so you can track the status of this redemption request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
  {
    kind: "file",
    name: "redemptionAgreement",
    label: "Do you have supporting documentation to attach?",
    helper: "If there is a signed redemption request or authorization letter, please attach it here.",
  },
];

export const redemptionRequestSpec: FormSpec = {
  title: "Create a Redemption Request on AxisKey",
  descriptionParagraphs: [
    "A redemption is the process of withdrawing all or part of an investor's capital from an investment. The investment amount or terms may change. The investor or authorized signatory must complete this form to initiate the request.",
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
      { label: "Redemption Type", field: "redemptionType" },
      { label: "Redemption Amount (USD)", field: "redemptionAmount" },
      { label: "Issuer Approved Redemption", field: "issuerApprovedRedemption", skipIfEmpty: true },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes", skipIfEmpty: true },
    ],
    // All confirmed — investorAccountName/offeringName/orderNumber/
    // redemptionAmount/redemptionType/notes against real submitted tasks,
    // investorEmail/requesterEmail/issuerApprovedRedemption via
    // scripts/clickup/provision-forms.mjs (Sept 2026). redemptionType's
    // dropdown options here are "Full"/"Partial" (per the current form
    // spec) but still resolve to the same confirmed ClickUp option UUIDs,
    // which were created under the names "Full Redemption"/"Partial
    // Redemption" — see CUSTOM_FIELD_MAP in lib/integrations/clickup.ts.
    customFields: [
      { key: "investorAccountName", field: "investorAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "redemptionAmount", field: "redemptionAmount" },
      { key: "redemptionType", field: "redemptionType" },
      { key: "notes", field: "notes" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
      { key: "issuerApprovedRedemption", field: "issuerApprovedRedemption" },
    ],
  },
};
