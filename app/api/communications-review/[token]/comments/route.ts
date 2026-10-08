import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";

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

  return NextResponse.json({
    comment: { id: comment.id, author: comment.author, body: comment.body, createdAt: comment.created_at },
  });
}
