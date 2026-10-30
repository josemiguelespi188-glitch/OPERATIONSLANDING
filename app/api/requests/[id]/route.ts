import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

const ATTACHMENTS_BUCKET = "attachments";

/** Best-effort: pulls the storage key back out of a public attachments URL
 *  (".../object/public/attachments/<key>") so it can be removed too. Returns
 *  null for anything that doesn't look like one of our own attachment URLs,
 *  which the caller just skips rather than failing the whole delete over. */
function storageKeyFromPublicUrl(fileUrl: string): string | null {
  const marker = `/object/public/${ATTACHMENTS_BUCKET}/`;
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;
  const key = fileUrl.slice(i + marker.length);
  return key ? decodeURIComponent(key) : null;
}

/**
 * Deletes a request row outright -- admin-only, used to clean up test
 * submissions so they stop counting toward /admin's metrics (Total
 * Requests, by-status/by-sync-status breakdowns, Requests by Type all read
 * directly off the `requests` table, so a row left in place keeps skewing
 * them even if it's hidden from some view). `request_attachments` and
 * `activity_log` cascade (`on delete cascade`, see supabase/schema.sql),
 * so this only needs to also best-effort clean up the actual files in the
 * "attachments" Storage bucket, which the DB cascade can't reach.
 */
export async function DELETE(
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

  const { data: attachments } = await supabase
    .from("request_attachments")
    .select("file_url")
    .eq("request_id", id);

  const { error, count } = await supabase
    .from("requests")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const keys = (attachments ?? [])
    .map((a) => storageKeyFromPublicUrl(a.file_url))
    .filter((k): k is string => !!k);
  if (keys.length) {
    try {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove(keys);
    } catch {
      // Best-effort: the request row is already gone either way.
    }
  }

  return NextResponse.json({ ok: true });
}
