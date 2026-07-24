import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { syncRequestAndPersist } from "@/lib/services/requestSync";
import type { RequestPayload } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
