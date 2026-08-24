import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { investorInformationUpdateSpec } from "@/lib/formSpecs/investorInformationUpdate";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Information Update | AxisKey",
};

export default async function InvestorInformationUpdatePage() {
  const overrides = await loadFormOverrides("investor-information-update");
  const { fields, submissionMapping } = mergePublicFields(investorInformationUpdateSpec, overrides.fields);

  return (
    <FormShell
      slug="investor-information-update"
      title={investorInformationUpdateSpec.title}
      descriptionParagraphs={
        overrides.description ? [overrides.description] : investorInformationUpdateSpec.descriptionParagraphs
      }
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}
