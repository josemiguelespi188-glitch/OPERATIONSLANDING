"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadPdfjs } from "@/lib/pdfGenerator/pdfjs";
import type { PdfTemplateConfig } from "@/lib/pdfGenerator/types";
import { MappingEditor } from "@/components/admin/pdfgenerator/MappingEditor";
import { ClickUpFieldPicker } from "./ClickUpFieldPicker";
import {
  emptyDocumentConfig,
  type DocumentField,
  type DocumentTemplateConfig,
  type DocumentTemplateDetail,
  type DocumentTemplateSummary,
} from "@/lib/documentGenerator/types";

/**
 * MappingEditor only knows about PdfTemplateConfig/PdfField -- it can add
 * a plain text/image field of its own (via its own "+Text"/"+Image"
 * buttons) that never had a customFieldKey. Coerced to "" here rather
 * than rejected: generatePdf() already skips a field with no resolved
 * value, so an admin-added ad-hoc field just renders blank at generation
 * time instead of crashing or losing the rest of the mapping.
 */
function toDocumentConfig(next: PdfTemplateConfig): DocumentTemplateConfig {
  return {
    ...next,
    fields: next.fields.map((f) => ({ ...f, customFieldKey: (f as Partial<DocumentField>).customFieldKey ?? "" })),
  };
}

/**
 * The "2. Mapping" tab's content: a list of this request type's named
 * document mappings (an admin can hold several, e.g. different
 * Redemption Request document variants), each creatable/editable/
 * deletable here. Editing one shows the ClickUp field picker +
 * MappingEditor inline, same box-placement UI the PDF Generator tool
 * uses, unmodified.
 */
export function DocumentMappingManager({
  requestTypeId,
  templates,
  onChanged,
}: {
  requestTypeId: string;
  templates: DocumentTemplateSummary[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (editingId) {
    return (
      <MappingEditorPane
        requestTypeId={requestTypeId}
        templateId={editingId}
        onBack={() => {
          setEditingId(null);
          onChanged();
        }}
      />
    );
  }

  return (
    <MappingList
      requestTypeId={requestTypeId}
      templates={templates}
      onChanged={onChanged}
      onEdit={setEditingId}
    />
  );
}

function MappingList({
  requestTypeId,
  templates,
  onChanged,
  onEdit,
}: {
  requestTypeId: string;
  templates: DocumentTemplateSummary[];
  onChanged: () => void;
  onEdit: (id: string) => void;
}) {
  const adminFetch = useAdminFetch();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), fileName: file.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create the document mapping.");

      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from("request-document-templates")
        .uploadToSignedUrl(body.upload.path, body.upload.token, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setName("");
      setFile(null);
      onChanged();
      onEdit(body.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the document mapping.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(t: DocumentTemplateSummary) {
    if (!confirm(`Delete "${t.name}"? Its mapping and PDF will be removed.`)) return;
    setBusyId(t.id);
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates/${t.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not delete.");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="rounded-card border border-axis-base/30 bg-white p-5 shadow-card">
        <p className="text-sm font-semibold text-axis-core">New mapping</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Mapping name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Redemption Letter"
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
            disabled={!file || !name.trim() || creating}
            className="rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
          >
            {creating ? "Uploading..." : "Upload and map"}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {templates.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">
            No mappings yet. Create one above.
          </p>
        )}
        {templates.map((t, i) => (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${i !== 0 ? "border-t border-axis-base/20" : ""}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-axis-core">{t.name}</p>
              <p className="mt-0.5 truncate text-xs text-axis-core/50">
                {t.fileName ?? "No file"}
                {t.pageCount ? ` · ${t.pageCount} page${t.pageCount === 1 ? "" : "s"}` : ""} ·{" "}
                {t.mapping.fields.length} field{t.mapping.fields.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(t.id)}
                className="rounded-[8px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core hover:bg-axis-light"
              >
                Edit mapping
              </button>
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
        ))}
      </div>
    </div>
  );
}

function MappingEditorPane({
  requestTypeId,
  templateId,
  onBack,
}: {
  requestTypeId: string;
  templateId: string;
  onBack: () => void;
}) {
  const adminFetch = useAdminFetch();
  const [template, setTemplate] = useState<DocumentTemplateDetail | null>(null);
  const [templateBytes, setTemplateBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [name, setName] = useState("");
  const [mapping, setMapping] = useState<DocumentTemplateConfig>(emptyDocumentConfig);
  const [savedMapping, setSavedMapping] = useState(() => JSON.stringify(emptyDocumentConfig()));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates/${templateId}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Document mapping not found.");
        if (cancelled) return;
        const detail = body as DocumentTemplateDetail;
        setTemplate(detail);
        setName(detail.name);
        setMapping(detail.mapping);
        setSavedMapping(JSON.stringify(detail.mapping));
        if (!detail.fileUrl) throw new Error("This mapping has no PDF file. Delete it and create it again.");

        const fileRes = await fetch(detail.fileUrl);
        if (!fileRes.ok) throw new Error("Could not download the template PDF.");
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled) return;
        setTemplateBytes(bytes);
        setPdfDoc(doc);
        if (detail.pageCount !== doc.numPages) {
          adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates/${templateId}`, {
            method: "PATCH",
            body: JSON.stringify({ pageCount: doc.numPages }),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this mapping.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId, templateId]);

  const dirty = useMemo(
    () => JSON.stringify(mapping) !== savedMapping || (template !== null && name.trim() !== template.name),
    [mapping, savedMapping, name, template]
  );

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ mapping, name: name.trim() || template?.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setSavedMapping(JSON.stringify(body.mapping));
      setMapping(body.mapping);
      setName(body.name);
      setTemplate((t) => (t ? { ...t, name: body.name, mapping: body.mapping } : t));
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId, templateId, mapping, name, template]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-xs font-medium text-axis-core/50 hover:text-axis-core">
        ← All mappings
      </button>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && (!pdfDoc || !templateBytes) && (
        <p className="mt-10 text-center text-sm text-axis-core/50">Loading mapping...</p>
      )}

      {pdfDoc && templateBytes && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Mapping name"
              className="min-w-0 flex-1 max-w-md rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 font-head text-xl font-medium tracking-tight text-axis-core outline-none hover:border-axis-base/50 focus:border-axis-core focus:bg-white"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-axis-core/50">
                {dirty ? "Unsaved changes" : savedAt ? "Saved" : ""}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save mapping"}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <ClickUpFieldPicker requestTypeId={requestTypeId} config={mapping} onChange={setMapping} />
            <MappingEditor
              pdfDoc={pdfDoc}
              templateBytes={templateBytes}
              config={mapping}
              onChange={(next) => setMapping(toDocumentConfig(next))}
            />
          </div>
        </>
      )}
    </div>
  );
}
