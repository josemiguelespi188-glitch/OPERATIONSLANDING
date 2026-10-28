"use client";

import { useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { GenerateFromOrderNumber } from "./GenerateFromOrderNumber";
import type { DocumentTemplateDetail, DocumentTemplateSummary } from "@/lib/documentGenerator/types";

/**
 * "1. Generate" tab: pick which of this request type's document
 * mappings to use (a type can have several -- e.g. different Redemption
 * Request document variants), then search by Order Number. Picking a
 * mapping lazily loads its full config + PDF bytes so generation always
 * uses the saved version.
 */
export function GenerateTab({
  requestTypeId,
  templates,
}: {
  requestTypeId: string;
  templates: DocumentTemplateSummary[];
}) {
  const adminFetch = useAdminFetch();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [detail, setDetail] = useState<DocumentTemplateDetail | null>(null);
  const [templateBytes, setTemplateBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (templates.length > 0 && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setTemplateBytes(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates/${selectedId}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load this mapping.");
        if (cancelled) return;
        const d = body as DocumentTemplateDetail;
        if (!d.fileUrl) throw new Error("This mapping has no PDF file.");
        const fileRes = await fetch(d.fileUrl);
        if (!fileRes.ok) throw new Error("Could not download the template PDF.");
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        if (cancelled) return;
        setDetail(d);
        setTemplateBytes(bytes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this mapping.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId, selectedId]);

  if (templates.length === 0) {
    return (
      <p className="rounded-[8px] border border-axis-base/30 bg-axis-light px-3 py-2 text-sm text-axis-core/60">
        No document mappings exist yet for this request type. Create one in the Mapping tab first.
      </p>
    );
  }

  return (
    <div className="max-w-md">
      <label className="block">
        <span className="text-xs font-medium text-axis-core/70">Document mapping</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-1 w-full rounded-[8px] border border-axis-base/50 bg-white px-3 py-2 text-sm outline-none focus:border-axis-core"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-4 text-sm text-axis-core/50">Loading mapping...</p>}

      {!loading && detail && templateBytes && (
        <div className="mt-6">
          <GenerateFromOrderNumber
            requestTypeId={requestTypeId}
            templateId={detail.id}
            mappingName={detail.name}
            templateBytes={templateBytes}
            config={detail.mapping}
          />
        </div>
      )}
    </div>
  );
}
