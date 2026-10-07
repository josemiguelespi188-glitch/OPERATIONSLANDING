"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { fileToBase64 } from "@/lib/utils/downloadBlob";
import { SaReviewSubNav } from "./SaReviewSubNav";

interface FormatTemplateSummary {
  id: string;
  fileName: string;
  isActive: boolean;
  createdAt: string;
}

export function SaFormatTemplatesManager() {
  const adminFetch = useAdminFetch();
  const [templates, setTemplates] = useState<FormatTemplateSummary[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/sa-review/format-templates");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load templates.");
      setTemplates(body.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await adminFetch("/api/admin/sa-review/format-templates", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileBase64 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to upload the template.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload the template.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleActivate(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/format-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to activate the template.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate the template.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this format template?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/format-templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete the template.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the template.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <SaReviewSubNav active="templates" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
        <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
          Format Templates
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
          Upload a real Subscription Agreement the team has confirmed is correctly formatted for
          mapping. Its actual blank widths and table cell widths become the live reference every
          future review is judged against for space and alignment, instead of a generic rule of
          thumb. Only one template is active at a time.
        </p>
      </div>

      <div className="mt-8 rounded-card border border-dashed border-axis-base/50 bg-white px-6 py-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload reference template (.docx)"}
        </button>
        <p className="mt-3 text-xs text-axis-core/50">
          Uploading a new template automatically makes it the active one.
        </p>
      </div>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {templates === null && !error && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>
        )}
        {templates?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">
            No reference template uploaded yet -- reviews fall back to a built-in default rule of
            thumb for space and alignment.
          </p>
        )}
        {templates?.map((template, i) => (
          <div
            key={template.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${
              i !== 0 ? "border-t border-axis-base/20" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-axis-core">{template.fileName}</p>
                {template.isActive && (
                  <span className="whitespace-nowrap rounded-full bg-axis-signal px-2 py-0.5 text-[11px] font-semibold text-axis-core">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-axis-core/50">
                {new Date(template.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!template.isActive && (
                <button
                  type="button"
                  disabled={busyId === template.id}
                  onClick={() => handleActivate(template.id)}
                  className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                >
                  Activate
                </button>
              )}
              <button
                type="button"
                disabled={busyId === template.id}
                onClick={() => handleDelete(template.id)}
                className="rounded-[6px] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
