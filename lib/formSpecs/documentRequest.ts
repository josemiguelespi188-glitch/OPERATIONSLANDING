import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor being asked for documentation?",
    required: true,
    helper: "Enter the full legal name of the investor.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering this investor is associated with.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "select",
    name: "documentNeeded",
    label: "What document is needed from the investor?",
    required: true,
    helper: "Select the type of document being requested.",
    placeholder: "Select the type of document being requested.",
    options: [
      "Government ID",
      "Articles of Incorporation",
      "Trust Agreement",
      "Accreditation Letter",
      "Custodian Letter",
      "Operating Agreement",
      "Other",
    ],
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
  {
    kind: "textarea",
    name: "notes",
    label: "Please provide additional details",
    required: true,
    helper: "Add any additional context about what's needed or why.",
    placeholder:
      "Accreditation letter on file is expired; investor needs to provide an updated one dated within the last 90 days.",
    fullWidth: true,
  },
];

export const documentRequestSpec: FormSpec = {
  title: "Create an Investor Documentation Request on AxisKey",
  descriptionParagraphs: [
    "This request is used to ask an investor for outstanding or updated KYC/due diligence documentation needed to complete or maintain their account. The client or Capital Raiser must complete this form to initiate the request.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Document Needed", field: "documentNeeded" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // No confirmed ClickUp custom field IDs yet — this list has never
    // been provisioned. Run scripts/clickup/provision-forms.mjs and wire
    // the returned IDs into CUSTOM_FIELD_MAP.
  },
};
