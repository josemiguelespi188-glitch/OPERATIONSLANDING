export type CommunicationSectionType =
  | "section_1"
  | "section_2"
  | "faq_of_month"
  | "full_communication";

export type CommunicationStatus =
  | "building"
  | "pending_approval"
  | "changes_requested"
  | "ready_for_launch"
  | "deployed";

export type RecipientType = "all_investors" | "specific";

export interface Client {
  id: string;
  name: string;
}

export interface Approver {
  id: string;
  name: string;
  email: string;
}

export interface CommunicationComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export const SECTION_TYPE_LABELS: Record<CommunicationSectionType, string> = {
  section_1: "Section 1 (Who we are)",
  section_2: "Section 2 (Deadlines/reminders)",
  faq_of_month: "FAQ of the month",
  full_communication: "Full communication",
};

export const STATUS_LABELS: Record<CommunicationStatus, string> = {
  building: "Building",
  pending_approval: "Pending for Approval",
  changes_requested: "Changes requested",
  ready_for_launch: "Ready for Launch",
  deployed: "Deployed",
};

/** Status order the UI's "advance" action steps through (changes_requested is a detour, not a step). */
export const STATUS_ORDER: CommunicationStatus[] = [
  "building",
  "pending_approval",
  "ready_for_launch",
  "deployed",
];

export interface CommunicationRow {
  id: string;
  title: string;
  section_type: CommunicationSectionType;
  send_date: string | null;
  html_code: string | null;
  status: CommunicationStatus;
  faq_notes: string | null;
  recipient_type: RecipientType;
  approvers: string;
  approved_at: string | null;
  approved_by: string | null;
  requested_approver_name: string | null;
  requested_approver_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationSummary {
  id: string;
  title: string;
  sectionType: CommunicationSectionType;
  sendDate: string | null;
  htmlCode: string | null;
  status: CommunicationStatus;
  faqNotes: string | null;
  recipientType: RecipientType;
  approvers: string;
  approvedAt: string | null;
  approvedBy: string | null;
  requestedApproverName: string | null;
  requestedApproverEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCommunicationSummary(row: CommunicationRow): CommunicationSummary {
  return {
    id: row.id,
    title: row.title,
    sectionType: row.section_type,
    sendDate: row.send_date,
    htmlCode: row.html_code,
    status: row.status,
    faqNotes: row.faq_notes,
    recipientType: row.recipient_type,
    approvers: row.approvers,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    requestedApproverName: row.requested_approver_name,
    requestedApproverEmail: row.requested_approver_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CommunicationStatusHistoryEntry {
  id: string;
  fromStatus: CommunicationStatus | null;
  toStatus: CommunicationStatus;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
}
