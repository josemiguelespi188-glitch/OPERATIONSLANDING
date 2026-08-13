import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { syncRequestAndPersist } from "@/lib/services/requestSync";
import type { RequestPayload } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: existing, error } = await supabase
    .from("requests")
    .select("id, payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const sync = await syncRequestAndPersist(
    supabase,
    existing.id,
    existing.payload as RequestPayload
  );

  return NextResponse.json({
    synced: sync.synced,
    taskId: sync.taskId,
    error: sync.error,
  });
}
