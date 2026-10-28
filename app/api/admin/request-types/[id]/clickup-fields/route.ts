import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { getKnownClickUpFields } from "@/lib/documentGenerator/clickupFields";

export const dynamic = "force-dynamic";

/** The fields the document mapping's field picker can offer for this request type. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: requestType } = await supabase.from("request_types").select("slug").eq("id", id).maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  return NextResponse.json({ fields: await getKnownClickUpFields(requestType.slug) });
}
