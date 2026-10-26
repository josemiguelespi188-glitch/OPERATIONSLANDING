import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "select",
    name: "typeOfChange",
    label: "What type of name change is this?",
    required: true,
    helper: "Select the reason the name on file needs to be updated.",
    placeholder: "Select the type of change.",
    options: ["Legal Name Correction", "Marriage or Divorce Name Change", "Entity Name Change", "Other"],
  },
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor currently holding the order?",
    required: true,
    helper: "Enter the full legal name currently on file for the investor whose name is being changed.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account whose name is being updated.",
    placeholder: "sarah.dawson@email.com",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering associated with this investment order.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    helper: "If this name change is associated with a specific order, enter the corresponding order number.",
    placeholder: "10234",
  },
  {
    kind: "text",
    name: "currentAccountName",
    label: "What is the current name on file?",
    required: true,
    helper: "Enter the name currently registered on the AxisKey portal for this investment order.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "text",
    name: "newAccountName",
    label: "What is the new name?",
    required: true,
    helper: "Enter the corrected or updated name this investment order should be registered under.",
    placeholder: "Michael R. Dawson",
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    helper:
      "Enter your email address so you can track the status of this name change request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
  {
    kind: "file",
    name: "supportingDocumentation",
    label: "Do you have supporting documentation for this name change?",
    helper:
      "If available, attach documentation supporting the name change (e.g. marriage certificate, court order, or entity formation documents).",
  },
];

export const investmentChangeNameRequestSpec: FormSpec = {
  title: "Create an Investment Change Name Request on AxisKey",
  descriptionParagraphs: [
    "An Investment Change Name Request updates the name registered on an existing investment order, for example correcting a legal name, reflecting a marriage or divorce, or updating from an individual to an entity or trust name, without changing the investment itself. The amount, terms, and underlying order remain exactly the same; only the name on file is updated in AxisKey's internal system and portal. The investor or authorized signatory must complete this form to initiate the change.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Type of Change", field: "typeOfChange" },
      { label: "Investor Email", field: "investorEmail" },
      { label: "Order Number", field: "orderNumber" },
      { label: "Current Name", field: "currentAccountName" },
      { label: "New Name", field: "newAccountName" },
    ],
    // No CUSTOM_FIELD_MAP entry exists yet for this brand-new request
    // type -- a slug with no key there simply skips custom-field sync
    // (data still lands in the task description via buildTaskDescription)
    // until the ClickUp list exists and its field IDs are confirmed.
    // See CLAUDE.md's "Investment Change Name Request" section.
    customFields: [
      { key: "typeOfChange", field: "typeOfChange" },
      { key: "currentAccountName", field: "currentAccountName" },
      { key: "newAccountName", field: "newAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
