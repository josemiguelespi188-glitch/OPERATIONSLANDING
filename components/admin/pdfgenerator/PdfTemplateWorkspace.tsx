"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { loadPdfjs } from "@/lib/pdfGenerator/pdfjs";
import { emptyConfig, type PdfTemplateConfig, type PdfTemplateDetail } from "@/lib/pdfGenerator/types";
import { MappingEditor } from "./MappingEditor";
import { BulkGenerator } from "./BulkGenerator";

type Tab = "mapping" | "generate";

export function PdfTemplateWorkspace({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const [template, setTemplate] = useState<PdfTemplateDetail | null>(null);
  const [templateBytes, setTemplateBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [mapping, setMapping] = useState<PdfTemplateConfig>(emptyConfig);
  const [savedMapping, setSavedMapping] = useState(() => JSON.stringify(emptyConfig()));
  const [name, setName] = useState("");
  const [tab, setTab] = useState<Tab>("mapping");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "generate") setTab("generate");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/pdf-templates/${id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Template not found.");
        if (cancelled) return;
        const detail = body as PdfTemplateDetail;
        setTemplate(detail);
        setName(detail.name);
        setMapping(detail.mapping);
        setSavedMapping(JSON.stringify(detail.mapping));
        if (!detail.fileUrl) throw new Error("This template has no PDF file. Delete it and upload it again.");

        const fileRes = await fetch(detail.fileUrl);
        if (!fileRes.ok) throw new Error("Could not download the template PDF.");
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        const pdfjs = await loadPdfjs();
        // pdf.js transfers (detaches) the buffer it's given to its worker, so hand it a copy.
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled) return;
        setTemplateBytes(bytes);
        setPdfDoc(doc);
        if (detail.pageCount !== doc.numPages) {
          adminFetch(`/api/admin/pdf-templates/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ pageCount: doc.numPages }),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the template.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dirty = useMemo(
    () => JSON.stringify(mapping) !== savedMapping || (template !== null && name.trim() !== template.name),
    [mapping, savedMapping, name, template]
  );

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/pdf-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ mapping, name: name.trim() || template?.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setSavedMapping(JSON.stringify(body.mapping));
      setMapping(body.mapping);
      setTemplate((t) => (t ? { ...t, name: body.name, mapping: body.mapping } : t));
      setName(body.name);
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mapping, name, template]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div>
      <Link href="/admin/pdf-generator" className="text-xs font-medium text-axis-core/50 hover:text-axis-core">
        ← All templates
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Template name"
            className="w-full max-w-md rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 font-head text-2xl font-medium tracking-tight text-axis-core outline-none hover:border-axis-base/50 focus:border-axis-core focus:bg-white"
          />
          <p className="mt-1 px-1 text-xs text-axis-core/50">
            {template?.fileName}
            {pdfDoc ? ` · ${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? "" : "s"}` : ""}
          </p>
        </div>
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

      <div className="mt-6 flex gap-1 border-b border-axis-base/30">
        {(
          [
            ["mapping", "1. Mapping"],
            ["generate", "2. Generate PDFs"],
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

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && (!pdfDoc || !templateBytes) && (
        <p className="mt-10 text-center text-sm text-axis-core/50">Loading template...</p>
      )}

      {pdfDoc && templateBytes && (
        <div className="mt-6">
          {tab === "mapping" ? (
            <MappingEditor pdfDoc={pdfDoc} templateBytes={templateBytes} config={mapping} onChange={setMapping} />
          ) : (
            <BulkGenerator templateBytes={templateBytes} config={mapping} unsaved={dirty} />
          )}
        </div>
      )}
    </div>
  );
}
