import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "sa-reviews";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadSaReviewFile(
  supabase: SupabaseClient,
  reviewId: string,
  variant: "original" | "formatted",
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const path = `${reviewId}/${variant}-${sanitizeFileName(fileName)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload ${variant} file: ${error.message}`);
  }
  return path;
}

export async function downloadSaReviewFile(supabase: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message ?? "not found"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
