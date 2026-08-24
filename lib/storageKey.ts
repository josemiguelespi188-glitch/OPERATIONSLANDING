/**
 * Sanitizes a filename for use as (part of) a Supabase Storage object key.
 *
 * Storage keys reject characters that are perfectly normal in local
 * filenames — most commonly spaces, which show up in macOS screenshot
 * names like "Screenshot 2026-08-24 at 11.15.26 AM.png". Uploading with
 * those characters straight in the key fails with "Invalid key" before
 * the file ever reaches the bucket.
 *
 * This keeps the original `fileName` for display/metadata (AttachmentInput
 * still stores it as-is) and only sanitizes the value used to build the
 * storage path.
 */
export function sanitizeFileNameForStorageKey(fileName: string): string {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "file";
}
