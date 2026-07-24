import type { Metadata } from "next";
import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";

export const metadata: Metadata = {
  title: "IRA Funding Request | AxisKey",
};

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor Account Name",
    required: true,
    helper: "Make sure it's the same name on IFT system",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "dealName",
    label: "What's the deal name he is investing in?",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "iraName",
    label: "IRA Name",
    required: true,
    helper: "IRA Name",
    placeholder: "Enter text",
  },
  {
    kind: "currency",
    name: "investingAmount",
    label: "What's the investing amount?",
    required: true,
    placeholder: "Enter currency",
  },
  {
    kind: "file",
    name: "subscriptionAgreement",
    label: "Upload the Subscription Agreement",
    helper:
      "You will find this on IFT portal. Go to the investor order. It need to be completely sign.",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    helper: "You can find this number on IFT portal.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "ccEmail",
    label: "Add your email so you can be CC on the process",
    required: true,
    helper: "(Add your email so you can track this)",
    placeholder: "Enter email",
    fullWidth: true,
  },
];

export default function IraFundingRequestPage() {
  return (
    <FormShell
      slug="ira-funding-request"
      title="IRA Funding Request"
      descriptionParagraphs={[
        "By filling out this form, IFT it's gonna request for the funds to the specific IRA custodian.",
        "In order to IFT follow this process. The client or Capital Raiser needs to fill out this form.",
      ]}
      fields={fields}
      submissionMapping={{
        requestorNameFields: ["investorAccountName"],
        requestorEmailFields: ["ccEmail"],
        investorNameField: "investorAccountName",
        dealNameField: "dealName",
        notesFields: [
          { label: "IRA Name", field: "iraName" },
          { label: "Investing Amount", field: "investingAmount" },
          { label: "Order Number", field: "orderNumber" },
        ],
      }}
    />
  );
}
