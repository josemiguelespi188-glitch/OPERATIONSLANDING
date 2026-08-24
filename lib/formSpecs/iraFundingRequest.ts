import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { FieldConfig } from "@/components/axiskey-forms/FormShell";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor Account Name",
    required: true,
    helper: "Make sure it's the same name on the AxisKey system.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "dealName",
    label: "What's the deal name he is investing in?",
    required: true,
    helper: "Enter the exact name of the deal or offering the investor is funding.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "iraName",
    label: "IRA Name",
    required: true,
    helper: "Enter the name of the IRA custodian.",
    placeholder: "Enter text",
  },
  {
    kind: "currency",
    name: "investingAmount",
    label: "What's the investing amount?",
    required: true,
    helper: "Enter the exact amount being invested, in USD.",
    placeholder: "Enter currency",
  },
  {
    kind: "file",
    name: "subscriptionAgreement",
    label: "Upload the Subscription Agreement",
    helper:
      "You will find this on the AxisKey portal. Go to the investor order. It must be fully signed.",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    helper: "You can find this number on the AxisKey portal.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "ccEmail",
    label: "Add your email so you can be CC'd on the process",
    required: true,
    helper: "Add your email so you can track this request.",
    placeholder: "Enter email",
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
    dealNameField: "dealName",
    notesFields: [
      { label: "IRA Name", field: "iraName" },
      { label: "Investing Amount", field: "investingAmount" },
      { label: "Order Number", field: "orderNumber" },
    ],
    customFields: [
      { key: "offeringName", field: "dealName" },
      { key: "custodian", field: "iraName" },
      { key: "amountInvesting", field: "investingAmount" },
      { key: "orderNumber", field: "orderNumber" },
      { key: "ccEmail", field: "ccEmail" },
    ],
  },
};
