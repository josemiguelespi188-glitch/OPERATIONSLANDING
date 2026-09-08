import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor requesting the side letter?",
    required: true,
    helper: "Enter the full legal name of the investor associated with this side letter.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering this side letter applies to.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    required: true,
    helper: "Enter the order number associated with the investment this side letter applies to.",
    placeholder: "10234",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Please describe the side letter needed",
    required: true,
    helper: "Explain exactly what terms are being requested so the side letter can be drafted correctly.",
    placeholder:
      "Investor is requesting a 2% bonus payment on top of standard distribution terms, per agreement with the issuer.",
    fullWidth: true,
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    required: true,
    helper:
      "Enter your email address so you can track the status of this request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
];

export const sideLetterRequestSpec: FormSpec = {
  title: "Create a Side Letter Request on AxisKey",
  descriptionParagraphs: [
    "A side letter is a supplemental agreement between an investor and an issuer that modifies or adds terms to the original Subscription Agreement, such as bonus payments or adjusted interest rates. The client or Capital Raiser must complete this form to initiate the request.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Order Number", field: "orderNumber" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // All confirmed via scripts/clickup/provision-forms.mjs (Sept 2026).
    // sideLetterType (the "What type of side letter" dropdown) was
    // removed from this form (Sept 2026) as redundant with the template
    // picker above it, which already sets the terms description for the
    // common cases. The ClickUp "Side Letter Type" field itself still
    // exists (see CUSTOM_FIELD_MAP note in lib/integrations/clickup.ts)
    // but nothing on this form sends to it anymore.
    customFields: [
      { key: "orderNumber", field: "orderNumber" },
      { key: "offeringName", field: "offeringName" },
      { key: "notes", field: "notes" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
