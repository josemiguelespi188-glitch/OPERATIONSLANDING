import type { Metadata } from "next";
import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";

export const metadata: Metadata = {
  title: "Title Transfer Request | AxisKey",
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
    name: "dealName",
    label: "What's the deal name invested in?",
    required: true,
    helper: "Enter the exact name of the deal or offering where the title transfer is being requested.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "orderNumber",
    label: "Order Number",
    helper: "If the title transfer is associated with a specific order, enter the corresponding order number.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "currentAccountName",
    label: "Current Investor Account Name",
    required: true,
    helper:
      "Enter the name currently registered on the AxisKey portal for this investment order. This is the holder name that will be replaced.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "newAccountName",
    label: "New Investor Account Name",
    required: true,
    helper: "Enter the New Name of the Account we are transfering",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    helper:
      "Enter your email address so you can track the status of this title transfer request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "titleTransferComplete",
    label: "Title Transfer Complete",
    helper: "If there is a title Transfer Please Attach",
  },
];

export default function TitleTransferRequestPage() {
  return (
    <FormShell
      slug="title-transfer-request"
      title="CREATE A TITLE TRANSFER REQUEST ON AXISKEY"
      descriptionParagraphs={[
        "A title transfer is the process of moving an existing investment order from one investor account to another, without affecting the order itself. The investment, amount, and terms remain exactly the same, only the account holding the order is updated in AxisKey's internal system and portal. The investor or authorized signatory must complete this form to initiate the change.",
      ]}
      fields={fields}
      submissionMapping={{
        requestorNameFields: ["investorName"],
        requestorEmailFields: ["requesterEmail", "investorEmail"],
        investorNameField: "investorName",
        dealNameField: "dealName",
        notesFields: [
          { label: "Investor Email", field: "investorEmail" },
          { label: "Order Number", field: "orderNumber" },
          { label: "Current Investor Account Name", field: "currentAccountName" },
          { label: "New Investor Account Name", field: "newAccountName" },
        ],
        // Confirmed against real submitted tasks in the "Title Transfer
        // Requests" ClickUp list (see the ClickUp sync notice for caveats —
        // Investor Name/email have no confirmed destination field yet).
        customFields: [
          { key: "currentAccountName", field: "currentAccountName" },
          { key: "newAccountName", field: "newAccountName" },
          { key: "dealName", field: "dealName" },
          { key: "orderNumber", field: "orderNumber" },
        ],
      }}
    />
  );
}
