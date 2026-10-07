import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDocxEvidence } from "./extractDocx";

const BUCKET = "sa-format-templates";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export interface FormatTemplateRow {
  id: string;
  file_name: string;
  storage_path: string;
  is_active: boolean;
  created_at: string;
}

export async function uploadFormatTemplate(
  supabase: SupabaseClient,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const path = `${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload format template: ${error.message}`);
  }
  return path;
}

export async function downloadFormatTemplate(supabase: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Failed to download format template: ${error?.message ?? "not found"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const MAX_BLANKS = 15;
const MAX_TABLE_CELLS = 20;

/**
 * Builds a short, Claude-readable summary of the active "perfect format"
 * template's own structural measurements (blank widths, table cell
 * widths), so categories 1-2's auto_fix judgments are calibrated against
 * a real approved example instead of a generic rule of thumb. Returns
 * null when no template is active -- the system prompt's existing
 * built-in guidance (see analyzeWithClaude.ts) is the fallback "default
 * template" in that case.
 */
export async function getActiveFormatTemplateReference(supabase: SupabaseClient): Promise<string | null> {
  const { data: template } = await supabase
    .from("sa_format_templates")
    .select("id, storage_path, file_name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return null;

  const buffer = await downloadFormatTemplate(supabase, template.storage_path);
  const evidence = await extractDocxEvidence(buffer);

  const widestBlanks = [...evidence.blanks]
    .sort((a, b) => b.underscoreLength - a.underscoreLength)
    .slice(0, MAX_BLANKS)
    .map((b) => `${b.underscoreLength} underscores -- "${b.context}"`);

  const widestCells = [...evidence.tableCells]
    .filter((c) => c.widthDxa !== null)
    .sort((a, b) => (b.widthDxa ?? 0) - (a.widthDxa ?? 0))
    .slice(0, MAX_TABLE_CELLS)
    .map((c) => `${c.widthDxa} dxa -- "${c.context}"`);

  return [
    `Approved reference template: "${template.file_name}". This is a real document the team has confirmed is correctly formatted for mapping -- use its actual measurements below to judge whether the SA under review has a comparably wide blank/cell for the same kind of data, instead of guessing a reasonable width from scratch.`,
    widestBlanks.length > 0 ? `Blank underscore lengths in the reference template:\n${widestBlanks.join("\n")}` : null,
    widestCells.length > 0 ? `Table cell widths (dxa) in the reference template:\n${widestCells.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
