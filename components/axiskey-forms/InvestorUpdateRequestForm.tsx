"use client";

import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";
import { InvestorUpdateHelpSection } from "@/components/axiskey-forms/InvestorUpdateHelpSection";
import type { InvestorUpdateRequestInput } from "@/lib/investorUpdateRequest";

const UPLOAD_ACCEPT =
  ".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.png,.jpg,.jpeg,image/png,image/jpeg";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "requesterName",
    label: "Requester Name",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "requesterEmail",
    label: "Requester Email",
    required: true,
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "Offering Name",
    required: true,
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "textarea",
    name: "mainUpdate",
    label: "Main Update",
    required: true,
    helper: "Please summarize the most important developments since your last investor update.",
    placeholder:
      "Examples:\n- Construction reached 80% completion\n- Occupancy increased from 72% to 85%\n- Revenue exceeded projections\n- New strategic partnership signed\n- New acquisition completed\n- Distribution declared",
    fullWidth: true,
  },
  {
    kind: "multifile",
    name: "supportingFiles",
    label: "Upload Supporting Files",
    helper: "Accepted formats: PDF, DOCX, XLSX, PNG, JPG, JPEG.",
    accept: UPLOAD_ACCEPT,
    fullWidth: true,
  },
  {
    kind: "multifile",
    name: "imagesCharts",
    label: "Upload Images or Charts",
    helper:
      "Upload any images, graphs, renderings, performance charts, property photos, or other visual assets you would like included in the Investor Update.",
    accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
    fullWidth: true,
  },
  {
    kind: "select",
    name: "industryResearchOption",
    label: "Would you like AxisKey to supplement the update with industry and market insights?",
    required: true,
    placeholder: "Select an option",
    options: ["Yes", "No"],
    fullWidth: true,
  },
  {
    kind: "textarea",
    name: "additionalNotes",
    label: "Additional Notes",
    placeholder: "Include anything else you would like our team to know while preparing the update.",
    fullWidth: true,
  },
];

function buildSubmission(values: Record<string, string>): InvestorUpdateRequestInput {
  return {
    requesterName: values.requesterName ?? "",
    requesterEmail: values.requesterEmail ?? "",
    offeringName: values.offeringName ?? "",
    mainUpdate: values.mainUpdate ?? "",
    industryResearchOption: values.industryResearchOption === "No" ? "No" : "Yes",
    additionalNotes: values.additionalNotes || undefined,
  };
}

export function InvestorUpdateRequestForm() {
  return (
    <FormShell
      slug="investor-update-request"
      title="Investor Update Request"
      descriptionParagraphs={[
        "Keep your investors informed with timely and professional communications. Submit your latest updates and supporting materials and our team will prepare an Investor Update draft for review.",
      ]}
      fields={fields}
      initialValues={{ industryResearchOption: "Yes" }}
      beforeForm={<InvestorUpdateHelpSection />}
      submitEndpoint="/api/investor-update-requests"
      buildSubmission={buildSubmission}
      submitLabel="Request Investor Update"
      submissionMapping={{
        requestorNameFields: ["requesterName"],
        requestorEmailFields: ["requesterEmail"],
        notesFields: [],
      }}
    />
  );
}
