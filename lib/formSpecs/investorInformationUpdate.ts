import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor whose information needs to be updated?",
    required: true,
    helper: "Enter the full legal name of the investor.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account associated with this update.",
    placeholder: "michael.dawson@email.com",
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
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    helper: "If this update relates to a specific order, enter the corresponding order number.",
    placeholder: "10234",
  },
  {
    kind: "textarea",
    name: "informationToUpdate",
    label: "What information needs to be updated?",
    required: true,
    helper: "Describe which field(s) need to be changed (e.g., mailing address, phone number, entity name).",
    placeholder: "Update mailing address to reflect investor's new residence.",
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

export const investorInformationUpdateSpec: FormSpec = {
  title: "Create an Investor Information Update Request on AxisKey",
  descriptionParagraphs: [
    "This request is used to update an investor's personal or account information already on file, such as name, address, phone number, or entity details. The client or Capital Raiser must complete this form to initiate the update.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Order Number", field: "orderNumber", skipIfEmpty: true },
      { label: "Requester Email", field: "requesterEmail" },
      { label: "Information to Update", field: "informationToUpdate" },
    ],
    // "Order Number" is new on this list — re-run
    // scripts/clickup/provision-forms.mjs to create it, then add it here.
    // Offering Name, Note (used for informationToUpdate), Investor Email,
    // and Requester Email are already confirmed/shared.
    customFields: [
      { key: "offeringName", field: "offeringName" },
      { key: "notes", field: "informationToUpdate" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
