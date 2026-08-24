import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper: "Enter the full legal name of the investor requesting the redemption.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    helper: "Enter the email address of the investor account associated with this redemption.",
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    required: true,
    helper:
      "Enter the order number associated with the investment being redeemed. You can find this on the AxisKey portal under the investor's order.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the Offering name invested in?",
    required: true,
    helper: "Enter the exact name of the deal or offering where the redemption is being requested.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor Account Name",
    required: true,
    helper: "Enter the name currently registered on the AxisKey portal for this investment order.",
    placeholder: "Enter text",
  },
  {
    kind: "select",
    name: "redemptionType",
    label: "Redemption Type",
    required: true,
    helper: "Select whether this is a full or partial redemption of the investment.",
    placeholder: "Select whether this is a full or partial redemption of the investment.",
    options: ["Full Redemption", "Partial Redemption"],
  },
  {
    kind: "currency",
    name: "redemptionAmount",
    label: "Redemption Amount",
    required: true,
    helper: "If partial, enter the exact amount to be redeemed in USD.",
    placeholder: "Enter currency",
  },
  {
    kind: "checkbox",
    name: "issuerApprovedRedemption",
    label: "Issuer Approved Redemption",
    helper: "Check this box if the issuer has already approved the redemption.",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Note",
    helper: "Explain the reason for the redemption request and any additional details relevant to processing it.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper:
      "Enter your email address so you can track the status of this redemption request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "redemptionAgreement",
    label: "Supporting Documentation",
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
    // Confirmed against real submitted tasks in the "Redemptions
    // Requests" ClickUp list (see the ClickUp sync notice for caveats).
    // "requesterEmail" and "issuerApprovedRedemption" are new fields
    // added to match the form spec — they have no confirmed ClickUp
    // custom field destination yet, so they're only sent via notes
    // above until a field ID is confirmed and added to
    // lib/integrations/clickup.ts's CUSTOM_FIELD_MAP.
    customFields: [
      { key: "investorAccountName", field: "investorAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "redemptionAmount", field: "redemptionAmount" },
      { key: "redemptionType", field: "redemptionType" },
      { key: "notes", field: "notes" },
    ],
  },
};
