/** Private bucket created by supabase/migrations/009_communications_calendar.sql. */
export const COMMUNICATIONS_HTML_BUCKET = "communications-html";

export type CommunicationSectionType =
  | "section_1"
  | "section_2"
  | "faq_of_month"
  | "full_communication";

export type CommunicationChannel = "tribexa" | "mass_email" | "tbd";

export type CommunicationStatus =
  | "idea"
  | "in_design"
  | "sent_for_approval"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "sent";

export const SECTION_TYPE_LABELS: Record<CommunicationSectionType, string> = {
  section_1: "Section 1 (Who we are)",
  section_2: "Section 2 (Deadlines/reminders)",
  faq_of_month: "FAQ of the month",
  full_communication: "Full communication",
};

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  tribexa: "Tribexa",
  mass_email: "Mass email platform",
  tbd: "To be defined",
};

export const STATUS_LABELS: Record<CommunicationStatus, string> = {
  idea: "Idea",
  in_design: "In design",
  sent_for_approval: "Sent for approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  scheduled: "Scheduled",
  sent: "Sent",
};

/** Status order the UI's "advance" action steps through. */
export const STATUS_ORDER: CommunicationStatus[] = [
  "idea",
  "in_design",
  "sent_for_approval",
  "approved",
  "scheduled",
  "sent",
];

export interface CommunicationRow {
  id: string;
  title: string;
  section_type: CommunicationSectionType;
  send_date: string | null;
  segment: string | null;
  channel: CommunicationChannel;
  html_url: string | null;
  html_file_path: string | null;
  html_file_name: string | null;
  status: CommunicationStatus;
  compliance_report: string | null;
  faq_notes: string | null;
  responsible: string | null;
  approvers: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationSummary {
  id: string;
  title: string;
  sectionType: CommunicationSectionType;
  sendDate: string | null;
  segment: string | null;
  channel: CommunicationChannel;
  htmlUrl: string | null;
  hasHtmlFile: boolean;
  htmlFileName: string | null;
  status: CommunicationStatus;
  complianceReport: string | null;
  faqNotes: string | null;
  responsible: string | null;
  approvers: string;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCommunicationSummary(row: CommunicationRow): CommunicationSummary {
  return {
    id: row.id,
    title: row.title,
    sectionType: row.section_type,
    sendDate: row.send_date,
    segment: row.segment,
    channel: row.channel,
    htmlUrl: row.html_url,
    hasHtmlFile: !!row.html_file_path,
    htmlFileName: row.html_file_name,
    status: row.status,
    complianceReport: row.compliance_report,
    faqNotes: row.faq_notes,
    responsible: row.responsible,
    approvers: row.approvers,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
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
