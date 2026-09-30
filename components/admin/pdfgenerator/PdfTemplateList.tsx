"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PdfTemplateSummary } from "@/lib/pdfGenerator/types";

export function PdfTemplateList() {
  const adminFetch = useAdminFetch();
  const router = useRouter();
  const [templates, setTemplates] = useState<PdfTemplateSummary[] | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/pdf-templates");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${body.error ?? "Failed to load templates."} (status ${res.status})`);
      setTemplates(body.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setCreating(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/pdf-templates", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || file.name.replace(/\.pdf$/i, ""), fileName: file.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create the template.");

      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from("pdf-templates")
        .uploadToSignedUrl(body.upload.path, body.upload.token, file, { contentType: "application/pdf" });
      if (uploadError) {
        await adminFetch(`/api/admin/pdf-templates/${body.template.id}`, { method: "DELETE" });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      router.push(`/admin/pdf-generator/${body.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the template.");
      setCreating(false);
    }
  }

  async function handleDelete(template: PdfTemplateSummary) {
    if (!confirm(`Delete "${template.name}"? The template PDF and its mapping will be removed.`)) return;
    setBusyId(template.id);
    try {
      const res = await adminFetch(`/api/admin/pdf-templates/${template.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Tools</p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">PDF Generator</h1>
      <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
        Upload a PDF once, mark where the name and the logo go, then bulk upload logos and names
        to get one personalized PDF for each.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-card border border-axis-base/30 bg-white p-5 shadow-card"
      >
        <p className="text-sm font-semibold text-axis-core">New template</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Template name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Partner Certificate"
              className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Base PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-axis-core/70 file:mr-3 file:rounded-[6px] file:border-0 file:bg-axis-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-axis-core"
            />
          </label>
          <button
            type="submit"
            disabled={!file || creating}
            className="rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
          >
            {creating ? "Uploading..." : "Upload and map"}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {templates === null && !error && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>
        )}
        {templates?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">No templates yet. Upload your first PDF above.</p>
        )}
        {templates?.map((t, i) => {
          const fields = t.mapping.fields;
          return (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${i !== 0 ? "border-t border-axis-base/20" : ""}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-axis-core">{t.name}</p>
                <p className="mt-0.5 truncate text-xs text-axis-core/50">
                  {t.fileName ?? "No file"}
                  {t.pageCount ? ` · ${t.pageCount} page${t.pageCount === 1 ? "" : "s"}` : ""} ·{" "}
                  {fields.length ? fields.map((f) => f.label).join(", ") : "no fields yet"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/pdf-generator/${t.id}`}
                  className="rounded-[8px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core hover:bg-axis-light"
                >
                  Edit mapping
                </Link>
                <Link
                  href={`/admin/pdf-generator/${t.id}?tab=generate`}
                  className="rounded-[8px] bg-axis-core px-3 py-1.5 text-xs font-semibold text-white hover:bg-axis-core/90"
                >
                  Generate
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  disabled={busyId === t.id}
                  className="rounded-[8px] px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
