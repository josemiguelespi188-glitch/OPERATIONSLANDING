import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorAccountName",
    label: "What is the investor's account name?",
    required: true,
    helper: "Make sure it's the same name on the AxisKey system.",
    placeholder: "Michael Dawson",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the offering name he is investing in?",
    required: true,
    helper: "Enter the exact name of the offering the investor is funding.",
    placeholder: "Meridian Property Holdings",
  },
  {
    kind: "text",
    name: "custodian",
    label: "What is the name of the IRA custodian?",
    required: true,
    helper: "Enter the name of the IRA custodian.",
    placeholder: "Sterling Custodial Trust",
  },
  {
    kind: "currency",
    name: "investingAmount",
    label: "What's the investing amount?",
    required: true,
    helper: "Enter the exact amount being invested, in USD.",
    placeholder: "50,000",
  },
  {
    kind: "file",
    name: "subscriptionAgreement",
    label: "Can you upload the signed Subscription Agreement?",
    helper: "You will find this on the AxisKey portal. Go to the investor order. It must be fully signed.",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "What is the order number?",
    helper: "You can find this number on the AxisKey portal.",
    placeholder: "10234",
  },
  {
    kind: "email",
    name: "ccEmail",
    label: "What is your email so you can be CC'd on this request?",
    required: true,
    helper: "Add your email so you can track this request.",
    placeholder: "agent@axiskey.com",
    fullWidth: true,
  },
];

export const iraFundingRequestSpec: FormSpec = {
  title: "IRA Funding Request",
  descriptionParagraphs: [
    "By filling out this form, AxisKey will request the funds from the specific IRA custodian. To complete this process, the client or Capital Raiser must fill out this form.",
  ],
  fields,
  submissionMapping: {
    requestorNameFields: ["investorAccountName"],
    requestorEmailFields: ["ccEmail"],
    investorNameField: "investorAccountName",
    dealNameField: "offeringName",
    notesFields: [
      { label: "Custodian", field: "custodian" },
      { label: "Investing Amount", field: "investingAmount" },
      { label: "Order Number", field: "orderNumber" },
    ],
    customFields: [
      { key: "offeringName", field: "offeringName" },
      { key: "custodian", field: "custodian" },
      { key: "amountInvesting", field: "investingAmount" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "ccEmail", field: "ccEmail" },
    ],
  },
};
