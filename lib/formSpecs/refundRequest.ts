import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor receiving the refund?",
    required: true,
    helper: "Enter the full legal name of the investor who should receive the refund.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account associated with this refund.",
    placeholder: "michael.dawson@email.com",
  },
  {
    kind: "textarea",
    name: "reasonForRefund",
    label: "Why is this refund being requested?",
    required: true,
    helper: "Briefly explain why the refund is being requested (e.g., overpayment, canceled order, duplicate charge).",
    placeholder: "Investor was double-charged during initial funding; duplicate payment to be refunded.",
    fullWidth: true,
  },
  {
    kind: "currency",
    name: "refundAmount",
    label: "How much is being refunded?",
    required: true,
    helper: "Enter the exact amount to be refunded, in USD.",
    placeholder: "5,000",
  },
  {
    kind: "file",
    name: "refundDocumentation",
    label: "Do you have supporting documentation to attach?",
    required: true,
    helper: "If there is proof of payment or a supporting document for the refund, please attach it here.",
  },
];

export const refundRequestSpec: FormSpec = {
  title: "Create a Refund Request on AxisKey",
  descriptionParagraphs: [
    "A refund is the process of returning funds to an investor for a payment made in error, an overpayment, or a canceled order, without affecting any other active investment and not having a Subscription Agreement sign. The client or Capital Raiser must complete this form to initiate the refund.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["investorEmail"],
    investorNameField: "investorName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Reason for Refund", field: "reasonForRefund" },
      { label: "Refund Amount (USD)", field: "refundAmount" },
    ],
    // Confirmed via scripts/clickup/provision-forms.mjs (Sept 2026) —
    // see CUSTOM_FIELD_MAP / ATTACHMENT_FIELD_MAP in
    // lib/integrations/clickup.ts.
    customFields: [
      { key: "investorEmail", field: "investorEmail" },
      { key: "reasonForRefund", field: "reasonForRefund" },
      { key: "refundAmount", field: "refundAmount" },
    ],
  },
};
