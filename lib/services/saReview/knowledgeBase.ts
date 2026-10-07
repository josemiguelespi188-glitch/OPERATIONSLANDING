import type { SupabaseClient } from "@supabase/supabase-js";

export interface SkillKnowledgeRow {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Caps the combined knowledge base text injected into every review's
// Claude call -- keeps a runaway amount of pasted reference material
// from silently inflating the per-review token cost. An admin adding
// more than this should trim older/superseded entries instead.
const MAX_TOTAL_CHARS = 6000;

/**
 * Concatenates every active sa_skill_knowledge entry (most recently
 * updated first) into one block for the Claude system prompt, capped at
 * MAX_TOTAL_CHARS. Returns null when there are no active entries.
 */
export async function getActiveSkillKnowledgeText(supabase: SupabaseClient): Promise<string | null> {
  const { data: entries } = await supabase
    .from("sa_skill_knowledge")
    .select("title, content")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (!entries || entries.length === 0) return null;

  let combined = "";
  for (const entry of entries) {
    const block = `## ${entry.title}\n${entry.content}`;
    if (combined.length + block.length > MAX_TOTAL_CHARS) break;
    combined += (combined ? "\n\n" : "") + block;
  }

  return combined || null;
}
