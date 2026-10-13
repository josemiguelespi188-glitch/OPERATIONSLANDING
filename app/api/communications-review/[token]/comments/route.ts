import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";
import { notifyAnnelise } from "@/lib/services/communications/notifyAnnelise";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comment text is required." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const row = await getPendingCommunicationByToken(supabase, token);
  if (!row) return NextResponse.json({ error: "This review link is no longer valid." }, { status: 404 });

  const author = row.requested_approver_name || row.requested_approver_email || "Approver";
  const { data: comment, error } = await supabase
    .from("communication_comments")
    .insert({ communication_id: row.id, author, body: text })
    .select("id, author, body, created_at")
    .single();
  if (error || !comment) return NextResponse.json({ error: error?.message ?? "Could not add the comment." }, { status: 500 });

  // Best-effort: never fails the comment post itself if the
  // notification can't be sent -- same pattern as every other email here.
  const emailResult = await notifyAnnelise({
    communicationId: row.id,
    communicationTitle: row.title,
    subject: `New comment: ${row.title}`,
    message: `<strong>${author}</strong> left a comment on this communication:</p><p style="margin:12px 0;padding:12px;background:#f6f4f0;border-radius:8px;">${text}`,
  });
  if (!emailResult.sent) {
    console.error(`[communications] comment notification not sent for ${row.id}:`, emailResult.error);
  }

  return NextResponse.json({
    comment: { id: comment.id, author: comment.author, body: comment.body, createdAt: comment.created_at },
  });
}
