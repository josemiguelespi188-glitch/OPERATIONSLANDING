import { getRequestType } from "./requestTypes";
import type { RequestFormInput, RequestPayload } from "./types";

/**
 * Builds the structured, integration-ready payload from a raw form
 * submission. This is the single place that shapes data for downstream
 * consumers (ClickUp API, n8n workflows) — keeping the mapping here means
 * wiring up a real integration later only touches lib/integrations/*.
 */
export function buildRequestPayload(input: RequestFormInput): RequestPayload {
  const requestType = getRequestType(input.requestType);

  return {
    requestType: input.requestType,
    requestTypeName: requestType?.name ?? input.requestType,
    requestorName: input.requestorName.trim(),
    requestorEmail: input.requestorEmail.trim(),
    investorName: input.investorName?.trim() ?? "",
    dealName: input.dealName?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    attachments: input.attachments ?? [],
    customFields: input.customFields ?? {},
    submittedAt: new Date().toISOString(),
  };
}
