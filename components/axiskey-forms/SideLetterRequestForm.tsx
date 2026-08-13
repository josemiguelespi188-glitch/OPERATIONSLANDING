"use client";

import { useState } from "react";
import { FormShell, type FieldConfig } from "@/components/axiskey-forms/FormShell";
import { SideLetterTemplateLibrary } from "@/components/axiskey-forms/SideLetterTemplateLibrary";
import { SIDE_LETTER_TEMPLATES, SIDE_LETTER_TYPE_OPTIONS } from "@/lib/sideLetterTemplates";

const fields: FieldConfig[] = [
  {
    kind: "text",
    name: "investorName",
    label: "Investor Name",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "offeringName",
    label: "Offering Name",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "text",
    name: "entityName",
    label: "Entity Name",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "investorEmail",
    label: "Investor Email",
    required: true,
    placeholder: "Enter email",
  },
  {
    kind: "text",
    name: "requestorName",
    label: "Requestor Name",
    required: true,
    placeholder: "Enter text",
  },
  {
    kind: "email",
    name: "requestorEmail",
    label: "Requestor Email",
    required: true,
    placeholder: "Enter email",
  },
  {
    kind: "date",
    name: "effectiveDate",
    label: "Effective Date",
    required: true,
    placeholder: "",
  },
  {
    kind: "select",
    name: "sideLetterType",
    label: "Requested Side Letter Type",
    required: true,
    placeholder: "Select a side letter type",
    options: SIDE_LETTER_TYPE_OPTIONS,
  },
  {
    kind: "textarea",
    name: "descriptionOfRequest",
    label: "Description of Request",
    required: true,
    placeholder: "Enter text",
    fullWidth: true,
  },
  {
    kind: "file",
    name: "supportingDocumentation",
    label: "Supporting Documentation",
  },
  {
    kind: "textarea",
    name: "additionalNotes",
    label: "Additional Notes",
    placeholder: "Enter text",
    fullWidth: true,
  },
];

export function SideLetterRequestForm() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});

  function handleSelectTemplate(templateId: string) {
    const template = SIDE_LETTER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setInitialValues({
      sideLetterType: template.sideLetterType,
      descriptionOfRequest: template.descriptionTemplate,
      selectedTemplate: template.name,
    });
  }

  return (
    <FormShell
      slug="side-letter-request"
      title="Side Letter Request"
      descriptionParagraphs={[
        "Request the creation of a side letter for an investor. Pick a template below for common requests, or fill out the form for a fully custom request.",
      ]}
      fields={fields}
      initialValues={initialValues}
      beforeForm={
        <SideLetterTemplateLibrary selectedId={selectedTemplateId} onSelect={handleSelectTemplate} />
      }
      submissionMapping={{
        requestorNameFields: ["investorName"],
        requestorEmailFields: ["requestorEmail"],
        investorNameField: "investorName",
        dealNameField: "offeringName",
        notesFields: [
          { label: "Entity Name", field: "entityName" },
          { label: "Investor Email", field: "investorEmail" },
          { label: "Requestor Name", field: "requestorName" },
          { label: "Effective Date", field: "effectiveDate" },
          { label: "Requested Side Letter Type", field: "sideLetterType" },
          { label: "Selected Template", field: "selectedTemplate", skipIfEmpty: true },
          { label: "Description of Request", field: "descriptionOfRequest" },
          { label: "Additional Notes", field: "additionalNotes", skipIfEmpty: true },
        ],
      }}
    />
  );
}
