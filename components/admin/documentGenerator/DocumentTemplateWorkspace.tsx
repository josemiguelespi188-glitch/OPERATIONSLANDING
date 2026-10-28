"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadPdfjs } from "@/lib/pdfGenerator/pdfjs";
import { MappingEditor } from "@/components/admin/pdfgenerator/MappingEditor";
import { ClickUpFieldPicker } from "./ClickUpFieldPicker";
import { GenerateFromOrderNumber } from "./GenerateFromOrderNumber";
import { emptyDocumentConfig, type DocumentField, type DocumentTemplateConfig, type DocumentTemplateDetail } from "@/lib/documentGenerator/types";
import type { PdfTemplateConfig } from "@/lib/pdfGenerator/types";

type Tab = "mapping" | "generate";

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

interface RequestTypeInfo {
  id: string;
  slug: string;
  name: string;
}

export function DocumentTemplateWorkspace({ requestTypeId }: { requestTypeId: string }) {
  const adminFetch = useAdminFetch();
  const [requestType, setRequestType] = useState<RequestTypeInfo | null>(null);
  const [template, setTemplate] = useState<DocumentTemplateDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [templateBytes, setTemplateBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [mapping, setMapping] = useState<DocumentTemplateConfig>(emptyDocumentConfig);
  const [savedMapping, setSavedMapping] = useState(() => JSON.stringify(emptyDocumentConfig()));

  const [tab, setTab] = useState<Tab>("mapping");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-template`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load this request type.");
      setRequestType(body.requestType);
      setTemplate(body.template);
      if (body.template) {
        setMapping(body.template.mapping);
        setSavedMapping(JSON.stringify(body.template.mapping));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this request type.");
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Once a template row (with a file) exists, download its PDF bytes and hand them to pdf.js.
  useEffect(() => {
    if (!template?.fileUrl) {
      setTemplateBytes(null);
      setPdfDoc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fileRes = await fetch(template.fileUrl!);
        if (!fileRes.ok) throw new Error("Could not download the template PDF.");
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled) return;
        setTemplateBytes(bytes);
        setPdfDoc(doc);
        if (template.pageCount !== doc.numPages) {
          adminFetch(`/api/admin/request-types/${requestTypeId}/document-template`, {
            method: "PATCH",
            body: JSON.stringify({ pageCount: doc.numPages }),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the template PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.fileUrl]);

  const dirty = useMemo(() => JSON.stringify(mapping) !== savedMapping, [mapping, savedMapping]);

  const saveMapping = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-template`, {
        method: "PATCH",
        body: JSON.stringify({ mapping }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save the mapping.");
      setSavedMapping(JSON.stringify(body.mapping));
      setMapping(body.mapping);
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the mapping.");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId, mapping]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-template/upload`, {
        method: "POST",
        body: JSON.stringify({ fileName: uploadFile.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create the document template.");

      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from("request-document-templates")
        .uploadToSignedUrl(body.upload.path, body.upload.token, uploadFile, { contentType: "application/pdf" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setUploadFile(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the PDF.");
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) {
    return <p className="mt-10 text-center text-sm text-axis-core/50">Loading...</p>;
  }

  return (
    <div>
      <Link href="/admin/forms" className="text-xs font-medium text-axis-core/50 hover:text-axis-core">
        ← Form Builder
      </Link>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-axis-core/50">
        Generate Document
      </p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
        {requestType?.name ?? "Request type"}
      </h1>

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!template && (
        <form onSubmit={handleUpload} className="mt-8 rounded-card border border-axis-base/30 bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-axis-core">Upload the base document</p>
          <p className="mt-1 text-xs text-axis-core/50">
            This mapping is saved once, for this request type -- you'll come back here any time to
            generate a filled document for a specific order, without redoing the layout.
          </p>
          <div className="mt-4 flex items-end gap-3">
            <label className="block flex-1">
              <span className="text-xs font-medium text-axis-core/70">Base PDF</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-axis-core/70 file:mr-3 file:rounded-[6px] file:border-0 file:bg-axis-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-axis-core"
              />
            </label>
            <button
              type="submit"
              disabled={!uploadFile || uploading}
              className="shrink-0 rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
            >
              {uploading ? "Uploading..." : "Upload and map"}
            </button>
          </div>
        </form>
      )}

      {template && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 border-b border-axis-base/30">
              {(
                [
                  ["mapping", "1. Mapping"],
                  ["generate", "2. Generate"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === key ? "border-axis-core text-axis-core" : "border-transparent text-axis-core/50 hover:text-axis-core"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "mapping" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-axis-core/50">
                  {dirty ? "Unsaved changes" : savedAt ? "Saved" : ""}
                </span>
                <button
                  type="button"
                  onClick={saveMapping}
                  disabled={!dirty || saving}
                  className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save mapping"}
                </button>
              </div>
            )}
          </div>

          {!pdfDoc || !templateBytes ? (
            <p className="mt-10 text-center text-sm text-axis-core/50">Loading template...</p>
          ) : tab === "mapping" ? (
            <div className="mt-6 space-y-4">
              <ClickUpFieldPicker requestTypeId={requestTypeId} config={mapping} onChange={setMapping} />
              <MappingEditor
                pdfDoc={pdfDoc}
                templateBytes={templateBytes}
                config={mapping}
                onChange={(next) => setMapping(toDocumentConfig(next))}
              />
            </div>
          ) : (
            <div className="mt-6">
              <GenerateFromOrderNumber
                requestTypeId={requestTypeId}
                requestTypeName={requestType?.name ?? "Document"}
                templateBytes={templateBytes}
                config={mapping}
                unsaved={dirty}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
