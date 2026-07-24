import type { Metadata } from "next";
import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";

export const metadata: Metadata = {
  title: "Redemption Request | AxisKey",
};

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    helper:
      "Enter the full legal name of the investor who currently holds the investment order being transferred.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor email",
    required: true,
    helper: "Enter the email address of the investor account that will receive the transferred order.",
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    required: true,
    helper:
      "Enter the order number associated with the investment being transferred. You can find this on the AxisKey portal under the investor's order.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the Offering name invested in?",
    required: true,
    helper: "Enter the exact name of the deal or offering where the title transfer is being requested.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor account name",
    required: true,
    helper: "Enter the name currently registered on the AxisKey portal for this investment order.",
    placeholder: "Enter text",
  },
  {
    kind: "select",
    name: "redemptionType",
    label: "Redemption type",
    required: true,
    helper: "Select whether this is a full or partial redemption of the investment.",
    placeholder: "Select whether this is a full or partial redemption of the investment.",
    options: ["Full Redemption", "Partial Redemption"],
  },
  {
    kind: "number",
    name: "redemptionAmount",
    label: "Redemption amount (USD)",
    required: true,
    helper: "If partial, enter the exact amount to be redeemed in USD.",
    placeholder: "Enter number",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Notes",
    helper: "Please explain the reason for the redemption request and any additional details relevant to processing it.",
    placeholder: "Enter text",
    fullWidth: true,
  },
];

export default function RedemptionRequestPage() {
  return (
    <FormShell
      slug="redemption-request"
      title="CREATE A REDEMPTION REQUEST ON AXISKEY"
      descriptionParagraphs={[
        "A redemption is the process of withdrawing all or part of an investor's capital from an investment. The investment amount or terms may change. The investor or authorized signatory must complete this form to initiate the request.",
      ]}
      fields={fields}
      submissionMapping={{
        requestorNameFields: ["investorName"],
        requestorEmailFields: ["investorEmail"],
        investorNameField: "investorAccountName",
        dealNameField: "offeringName",
        notesFields: [
          { label: "Order Number", field: "orderNumber" },
          { label: "Redemption Type", field: "redemptionType" },
          { label: "Redemption Amount (USD)", field: "redemptionAmount" },
          { label: "Notes", field: "notes", skipIfEmpty: true },
        ],
      }}
    />
  );
}
