import type { FormSpec } from "@/lib/dynamicForms/fieldConfigBridge";
import type { RequestTypeSlug } from "@/lib/requestTypes";
import { titleTransferRequestSpec } from "./titleTransferRequest";
import { redemptionRequestSpec } from "./redemptionRequest";
import { iraFundingRequestSpec } from "./iraFundingRequest";
import { refundRequestSpec } from "./refundRequest";
import { sideLetterRequestSpec } from "./sideLetterRequest";
import { investorInformationUpdateSpec } from "./investorInformationUpdate";
import { accountMaintenanceRequestSpec } from "./accountMaintenanceRequest";
import { documentRequestSpec } from "./documentRequest";
import { axiskeyReportRequestSpec } from "./axiskeyReportRequest";

/**
 * Every locked (code-driven) form's base spec, keyed by slug. This is what
 * the admin Form Builder reads to show/edit a locked type's copy (see
 * RequestTypeEditor) — the single source of truth for field structure,
 * order, and ClickUp mapping, which the database can only layer text
 * overrides and extra questions on top of (fieldConfigBridge.ts).
 */
export const FORM_SPECS: Partial<Record<RequestTypeSlug, FormSpec>> = {
  "title-transfer-request": titleTransferRequestSpec,
  "redemption-request": redemptionRequestSpec,
  "ira-funding-request": iraFundingRequestSpec,
  "refund-request": refundRequestSpec,
  "side-letter-request": sideLetterRequestSpec,
  "investor-information-update": investorInformationUpdateSpec,
  "account-maintenance-request": accountMaintenanceRequestSpec,
  "document-request": documentRequestSpec,
  "axiskey-report-request": axiskeyReportRequestSpec,
};
