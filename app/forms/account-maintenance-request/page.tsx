import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { accountMaintenanceRequestSpec } from "@/lib/formSpecs/accountMaintenanceRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Maintenance Request | AxisKey",
};

export default async function AccountMaintenanceRequestPage() {
  const overrides = await loadFormOverrides("account-maintenance-request");
  const { fields, submissionMapping } = mergePublicFields(accountMaintenanceRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="account-maintenance-request"
      title={accountMaintenanceRequestSpec.title}
      descriptionParagraphs={
        overrides.description ? [overrides.description] : accountMaintenanceRequestSpec.descriptionParagraphs
      }
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}
