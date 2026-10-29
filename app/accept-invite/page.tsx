import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";

export const metadata: Metadata = {
  title: "Accept Invite | AxisKey",
};

/**
 * Where a Team invite email's link lands (see app/api/admin/team/invite
 * and CLAUDE.md's "Team invites" section). Standalone, outside app/admin
 * on purpose, same reasoning as /rate-your-experience and
 * /support-inquiry: it needs to work for someone who has no admin
 * session yet (an invite link grants one via a URL hash Supabase's
 * client auto-detects, but app/admin/layout.tsx's gate shouldn't wrap
 * the "set your password" step -- that would show the full sidebar
 * before the invitee has actually finished setting up their account).
 */
export default function AcceptInvitePage() {
  return <AcceptInviteForm />;
}
