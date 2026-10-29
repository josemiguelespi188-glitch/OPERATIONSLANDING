import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-5-5";

/**
 * "Generate AI Explanation" on the Support Inquiry form -- expands
 * whatever brief note the person typed (e.g. "no encuentro mis
 * distributions") into a clearer, more complete explanation before
 * submitting, so the resulting Zendesk ticket gives support more to
 * work with. Requires the same login as the rest of /support-inquiry
 * now (Oct 2026) -- deliberately still capped on input/output length to
 * bound cost exposure from this being a Claude-API endpoint.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 1000) : "";

  if (!subject && !detail) {
    return NextResponse.json({ error: "Enter a subject or some detail first." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        "You help write clearer investor support tickets for AxisKey, an investment operations platform. Given a short subject line and a brief, possibly informal note from an investor or an AxisKey team member submitting on their behalf, rewrite it into a clear, professional 2-4 sentence explanation of the issue, suitable for a support ticket. Never invent specific facts (dates, amounts, account numbers, names) that aren't already stated -- only clarify and organize what's actually there. If the note is already clear, return a lightly polished version rather than padding it. Respond with only the explanation text, no preamble.",
      messages: [
        {
          role: "user",
          content: `Subject: ${subject || "(none given)"}\n\nNote: ${detail || "(none given)"}`,
        },
      ],
    });

    const explanation = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!explanation) {
      return NextResponse.json({ error: "Could not generate an explanation." }, { status: 502 });
    }

    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("Support inquiry AI explanation failed:", err);
    return NextResponse.json({ error: "Could not generate an explanation right now." }, { status: 502 });
  }
}
