import type { AttachmentInput } from "@/lib/types";

/** Shape POSTed by the Investor Update Request form to
 *  /api/investor-update-requests. Deliberately its own shape (not the
 *  generic requestorName/investorName/dealName/notes one every other
 *  request type sends to /api/requests) since this request type has its
 *  own dedicated tables with structured columns per field. */
export interface InvestorUpdateRequestInput {
  requesterName: string;
  requesterEmail: string;
  offeringName: string;
  mainUpdate: string;
  industryResearchOption: "Yes" | "No";
  additionalNotes?: string;
  attachments?: AttachmentInput[];
}

export interface InvestorUpdateRequestRecord {
  id: string;
  requester_name: string;
  requester_email: string;
  offering_name: string;
  main_update: string;
  industry_research_option: "Yes" | "No";
  additional_notes: string | null;
  status: InvestorUpdateStatus;
  clickup_task_id: string | null;
  clickup_synced_at: string | null;
  clickup_sync_status: "pending" | "synced" | "failed";
  clickup_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export type InvestorUpdateStatus =
  | "submitted"
  | "in_progress"
  | "draft_created"
  | "pending_client_approval"
  | "approved"
  | "published"
  | "completed";
