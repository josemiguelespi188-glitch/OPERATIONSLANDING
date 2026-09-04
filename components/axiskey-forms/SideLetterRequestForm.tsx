"use client";

import { useState } from "react";
import { FormShell, type FieldConfig, type SubmissionMapping } from "@/components/axiskey-forms/FormShell";
import { SideLetterTemplateLibrary } from "@/components/axiskey-forms/SideLetterTemplateLibrary";
import { SIDE_LETTER_TEMPLATES } from "@/lib/sideLetterTemplates";

interface SideLetterRequestFormProps {
  title: string;
  descriptionParagraphs: string[];
  fields: FieldConfig[];
  submissionMapping: SubmissionMapping;
}

/**
 * Thin client wrapper around FormShell that adds the template-picker UX on
 * top of whatever fields the server resolved (code spec + any admin
 * overrides — see app/forms/side-letter-request/page.tsx). Only prefills
 * the "notes" field (the free-text side letter description); everything
 * else about the resolved fields/mapping is passed through untouched, so
 * admin overrides keep working.
 *
 * The old "sideLetterTerms" field this used to prefill no longer exists
 * in the current form spec (replaced by the "sideLetterType" dropdown +
 * "notes" textarea) — retargeted to "notes" so the template picker keeps
 * working with the current field set.
 */
export function SideLetterRequestForm({
  title,
  descriptionParagraphs,
  fields,
  submissionMapping,
}: SideLetterRequestFormProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});

  function handleSelectTemplate(templateId: string) {
    const template = SIDE_LETTER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setInitialValues({ notes: template.termsTemplate });
  }

  return (
    <FormShell
      slug="side-letter-request"
      title={title}
      descriptionParagraphs={descriptionParagraphs}
      fields={fields}
      initialValues={initialValues}
      beforeForm={
        <SideLetterTemplateLibrary selectedId={selectedTemplateId} onSelect={handleSelectTemplate} />
      }
      submissionMapping={submissionMapping}
    />
  );
}
