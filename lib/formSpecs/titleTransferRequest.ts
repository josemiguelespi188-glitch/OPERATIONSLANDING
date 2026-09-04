import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Who is the investor currently holding the order?",
    required: true,
    helper:
      "Enter the full legal name of the investor who currently holds the investment order being transferred.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "What is the investor's email address?",
    required: true,
    helper: "Enter the email address of the investor account that will receive the transferred order.",
    placeholder: "sarah.dawson@email.com",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name invested in?",
    required: true,
    helper: "Enter the exact name of the offering where the title transfer is being requested.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    helper: "If the title transfer is associated with a specific order, enter the corresponding order number.",
    placeholder: "10234",
  },
  {
    kind: "text",
    name: "currentAccountName",
    label: "What is the current account name on file?",
    required: true,
    helper:
      "Enter the name currently registered on the AxisKey portal for this investment order. This is the holder name that will be replaced.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "text",
    name: "newAccountName",
    label: "What is the new account name?",
    required: true,
    helper: "Enter the new name of the account we are transferring the order to.",
    placeholder: "Sarah Dawson",
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "What is your email address?",
    helper:
      "Enter your email address so you can track the status of this title transfer request and receive updates as it is processed.",
    placeholder: "agent@axiskey.com",
  },
  {
    kind: "file",
    name: "titleTransferComplete",
    label: "Do you have a signed title transfer document to attach?",
    helper: "If there is a signed title transfer document, please attach it here.",
  },
];

export const titleTransferRequestSpec: FormSpec = {
  title: "Create a Title Transfer Request on AxisKey",
  descriptionParagraphs: [
    "A title transfer is the process of moving an existing investment order from one investor account to another, without affecting the order itself. The investment, amount, and terms remain exactly the same, only the account holding the order is updated in AxisKey's internal system and portal. The investor or authorized signatory must complete this form to initiate the change.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorName"],
    requestorEmailFields: ["requesterEmail", "investorEmail"],
    investorNameField: "investorName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Investor Email", field: "investorEmail" },
      { label: "Order Number", field: "orderNumber" },
      { label: "Current Account Name", field: "currentAccountName" },
      { label: "New Account Name", field: "newAccountName" },
    ],
    // currentAccountName/newAccountName/offeringName/orderNumber confirmed
    // against real submitted tasks in the "Title Transfer Requests"
    // ClickUp list. investorEmail/requesterEmail are included here so
    // they start flowing the moment CUSTOM_FIELD_MAP gets their field IDs
    // (see lib/integrations/clickup.ts) — until then they're simply
    // ignored server-side, same as today, and still land in the notes.
    customFields: [
      { key: "currentAccountName", field: "currentAccountName" },
      { key: "newAccountName", field: "newAccountName" },
      { key: "offeringName", field: "offeringName" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "investorEmail", field: "investorEmail" },
      { key: "requesterEmail", field: "requesterEmail" },
    ],
  },
};
