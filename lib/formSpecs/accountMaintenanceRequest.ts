import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor associated with this account?",
    required: true,
    helper: "Enter the full legal name of the investor.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account associated with this request.",
    placeholder: "michael.dawson@email.com",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering this account is associated with.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Please explain the error and what needs to be corrected",
    required: true,
    helper: "Describe the issue in detail so the team can review and correct it accurately.",
    placeholder: "Order was allocated to the wrong share class; needs to be corrected from Class A to Class C.",
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

export const accountMaintenanceRequestSpec: FormSpec = {
  title: "Create an Account Maintenance Request on AxisKey",
  descriptionParagraphs: [
    "An account maintenance request covers corrections or adjustments needed on an investor's account or order (e.g., data entry errors, allocation corrections, status fixes) that fall outside a standard information update. The client or Capital Raiser must complete this form to initiate the correction.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Note", field: "notes" },
    ],
    // All confirmed/shared fields already in ClickUp — no re-provisioning
    // needed for this list.
    customFields: [
      { key: "offeringName", field: "offeringName" },
      { key: "notes", field: "notes" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
