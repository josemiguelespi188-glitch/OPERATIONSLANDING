import type { RequestTypeSlug } from "./requestTypes";

export type RequestStatus = "submitted" | "in_review" | "completed";

export interface AttachmentInput {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  contentType?: string;
}

/** Shape submitted by the client-side request form. */
export interface RequestFormInput {
  requestType: RequestTypeSlug;
  requestorName: string;
  requestorEmail: string;
  investorName?: string;
  dealName?: string;
  notes?: string;
  attachments?: AttachmentInput[];
}

/**
 * Normalized, integration-agnostic payload persisted on `requests.payload`.
 * This is the exact shape handed to downstream integrations (ClickUp, n8n)
 * once they're wired up — nothing about the DB schema leaks into it.
 */
export interface RequestPayload {
  requestType: string;
  requestTypeName: string;
  requestorName: string;
  requestorEmail: string;
  investorName: string;
  dealName: string;
  notes: string;
  attachments: AttachmentInput[];
  submittedAt: string;
}

export interface RequestRecord {
  id: string;
  request_type_slug: RequestTypeSlug;
  requestor_name: string;
  requestor_email: string;
  investor_name: string | null;
  deal_name: string | null;
  notes: string | null;
  status: RequestStatus;
  payload: RequestPayload;
  clickup_task_id: string | null;
  clickup_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
