"use client";

import { useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { downloadBytes, generatePdf } from "@/lib/pdfGenerator/generate";
import { resolveFileName } from "@/lib/pdfGenerator/types";
import type { DocumentTemplateConfig } from "@/lib/documentGenerator/types";

/**
 * The "1. Generate" tab's content, once a specific mapping is selected:
 * search this request type's ClickUp list by Order Number, pull that
 * task's current (reviewed) data, and fill the selected mapping with it.
 * Generation itself reuses generatePdf() from the PDF Generator tool
 * unchanged -- the only new work here is resolving field VALUES from
 * ClickUp instead of a manually typed/imported row.
 */
export function GenerateFromOrderNumber({
  requestTypeId,
  templateId,
  mappingName,
  templateBytes,
  config,
}: {
  requestTypeId: string;
  templateId: string;
  mappingName: string;
  templateBytes: Uint8Array;
  config: DocumentTemplateConfig;
}) {
  const adminFetch = useAdminFetch();
  const [orderNumber, setOrderNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastGeneratedFor, setLastGeneratedFor] = useState("");

  const hasFields = config.fields.length > 0;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await adminFetch(
        `/api/admin/request-types/${requestTypeId}/document-templates/${templateId}/generate`,
        { method: "POST", body: JSON.stringify({ orderNumber }) }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not generate the document.");

      const values: Record<string, string> = body.values;
      const bytes = await generatePdf(templateBytes, config, { text: values, images: {} });
      const fileName = resolveFileName(
        config,
        "",
        (field) => values[field.id] ?? "",
        `${mappingName} ${orderNumber}`.trim()
      );
      downloadBytes(bytes, `${fileName}.pdf`, "application/pdf");
      setLastGeneratedFor(orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the document.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasFields) {
    return (
      <p className="rounded-[8px] border border-axis-base/30 bg-axis-light px-3 py-2 text-sm text-axis-core/60">
        This mapping has no fields placed yet -- add and place at least one in the Mapping tab
        before generating a document from it.
      </p>
    );
  }

  return (
    <div className="max-w-md">
      <form onSubmit={handleGenerate} className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-xs font-medium text-axis-core/70">Order number</span>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="4316815030"
            required
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !orderNumber.trim()}
          className="rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
        >
          {busy ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!error && lastGeneratedFor && !busy && (
        <p className="mt-4 text-xs text-axis-core/50">
          Downloaded the document for order {lastGeneratedFor}.
        </p>
      )}

      <p className="mt-6 text-xs text-axis-core/40">
        This looks up the task on ClickUp live, pulling whatever the team has reviewed and edited
        there -- not what was originally submitted on the public form.
      </p>
    </div>
  );
}
