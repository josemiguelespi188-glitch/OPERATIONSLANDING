import type { Metadata } from "next";
import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";

export const metadata: Metadata = {
  title: "Custom Request | AxisKey",
};

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    helper: "Enter the full legal name of the investor associated with this request, if applicable.",
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    helper: "Enter the investor's email address, if applicable.",
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "What's the deal name invested in? (if applicable)",
    helper: "Enter the exact deal or offering name, if this request relates to one.",
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "investorAccountName",
    label: "Investor Account Name",
    helper: "Enter the name currently registered on the AxisKey portal, if applicable.",
    placeholder: "Enter text",
  },
  {
    kind: "textarea",
    name: "notes",
    label: "Describe your request",
    required: true,
    helper: "Explain in detail what you need help with.",
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "select",
    name: "priority",
    label: "Priority Level",
    helper: "Select how urgent this request is.",
    placeholder: "Select how urgent this request is.",
    options: ["Low", "Medium", "High"],
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    helper: "Enter your email address so you can track the status of this request and receive updates as it is processed.",
    placeholder: "Enter email",
  },
  {
    kind: "file",
    name: "supportingDocumentation",
    label: "Supporting Documentation",
    helper: "Attach any relevant files here.",
  },
];

export default function CustomRequestPage() {
  return (
    <FormShell
      slug="custom-request"
      title="Submit a Custom Request on AxisKey"
      descriptionParagraphs={[
        "Use this form for any request that isn't covered by the standard AxisKey processes. Provide as much detail as possible so the operations team can route it correctly.",
      ]}
      fields={fields}
      submissionMapping={{
        requestorNameFields: ["investorName", "requesterEmail"],
        requestorEmailFields: ["requesterEmail", "investorEmail"],
        investorNameField: "investorName",
        dealNameField: "offeringName",
        notesFields: [
          { label: "Investor Email", field: "investorEmail", skipIfEmpty: true },
          { label: "Investor Account Name", field: "investorAccountName", skipIfEmpty: true },
          { label: "Priority Level", field: "priority", skipIfEmpty: true },
          { label: "Requester Email", field: "requesterEmail" },
          { label: "Note", field: "notes" },
        ],
        // No confirmed ClickUp custom field IDs yet — see
        // scripts/clickup/provision-forms.mjs, which creates them, and
        // wire the returned field IDs into CUSTOM_FIELD_MAP once run.
      }}
    />
  );
}
