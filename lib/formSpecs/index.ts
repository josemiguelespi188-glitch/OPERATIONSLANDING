import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { RequestTypeSlug } from "@/lib/requestTypes";
import { titleTransferRequestSpec } from "./titleTransferRequest";
import { redemptionRequestSpec } from "./redemptionRequest";
import { iraFundingRequestSpec } from "./iraFundingRequest";
import { sideLetterRequestSpec } from "./sideLetterRequest";
import { investorInformationUpdateSpec } from "./investorInformationUpdate";
import { accountMaintenanceRequestSpec } from "./accountMaintenanceRequest";
import { customRequestSpec } from "./customRequest";
import { axiskeyReportRequestSpec } from "./axiskeyReportRequest";

/**
 * Every locked (code-driven) form's base spec, keyed by slug. This is what
 * the admin Form Builder reads to show/edit a locked type's copy (see
 * RequestTypeEditor) — the single source of truth for field structure,
 * order, and ClickUp mapping, which the database can only layer text
 * overrides and extra questions on top of (fieldConfigBridge.ts).
 */
export const FORM_SPECS: Partial<Record<RequestTypeSlug, FormSpec>> = {
  "ira-funding-request": iraFundingRequestSpec,
  "title-transfer-request": titleTransferRequestSpec,
  "redemption-request": redemptionRequestSpec,
  "side-letter-request": sideLetterRequestSpec,
  "investor-information-update": investorInformationUpdateSpec,
  "account-maintenance-request": accountMaintenanceRequestSpec,
  "custom-request": customRequestSpec,
  "axiskey-report-request": axiskeyReportRequestSpec,
};
