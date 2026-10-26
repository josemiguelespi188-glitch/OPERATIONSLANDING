import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { investmentChangeNameRequestSpec } from "@/lib/formSpecs/investmentChangeNameRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

// Fields/copy can be edited from the admin Form Builder — always fetch the
// latest overrides instead of caching a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investment Change Name Request | AxisKey",
};

export default async function InvestmentChangeNameRequestPage() {
  const overrides = await loadFormOverrides("investment-change-name-request");
  const { fields, submissionMapping } = mergePublicFields(investmentChangeNameRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="investment-change-name-request"
      title={investmentChangeNameRequestSpec.title}
      descriptionParagraphs={
        overrides.description ? [overrides.description] : investmentChangeNameRequestSpec.descriptionParagraphs
      }
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}
