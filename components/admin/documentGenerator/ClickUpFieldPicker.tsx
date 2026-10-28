"use client";

import { useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { newId } from "@/lib/pdfGenerator/types";
import type { DocumentField, DocumentTemplateConfig } from "@/lib/documentGenerator/types";
import type { KnownClickUpField } from "@/lib/documentGenerator/clickupFields";

/**
 * Sits above MappingEditor in the Mapping tab. Lets the admin add fields
 * sourced from this request type's already-confirmed ClickUp custom
 * fields -- removing a field (and its boxes) is handled by
 * MappingEditor's own existing field list, so this component only ever
 * adds.
 */
export function ClickUpFieldPicker({
  requestTypeId,
  config,
  onChange,
}: {
  requestTypeId: string;
  config: DocumentTemplateConfig;
  onChange: (next: DocumentTemplateConfig) => void;
}) {
  const adminFetch = useAdminFetch();
  const [known, setKnown] = useState<KnownClickUpField[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/clickup-fields`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load this request type's ClickUp fields.");
        if (!cancelled) setKnown(body.fields);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load ClickUp fields.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId]);

  const includedKeys = new Set(config.fields.map((f) => f.customFieldKey));
  const available = (known ?? []).filter((f) => !includedKeys.has(f.key));

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addSelected() {
    const toAdd = (known ?? []).filter((f) => selected.has(f.key));
    if (toAdd.length === 0) return;
    const newFields: DocumentField[] = toAdd.map((f) => ({
      id: newId(),
      label: f.label,
      type: "text",
      sample: "",
      defaultValue: "",
      customFieldKey: f.key,
    }));
    onChange({ ...config, fields: [...config.fields, ...newFields] });
    setSelected(new Set());
  }

  if (error) {
    return <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (known === null) {
    return <p className="text-sm text-axis-core/50">Loading known ClickUp fields...</p>;
  }

  if (known.length === 0) {
    return (
      <p className="rounded-[8px] border border-axis-base/30 bg-axis-light px-3 py-2 text-sm text-axis-core/60">
        No confirmed ClickUp fields exist yet for this request type (see CUSTOM_FIELD_MAP in
        lib/integrations/clickup.ts). Nothing can be mapped until at least one is wired.
      </p>
    );
  }

  return (
    <div className="rounded-card border border-axis-base/30 bg-white p-4">
      <p className="text-sm font-semibold text-axis-core">Add fields from ClickUp</p>
      <p className="mt-1 text-xs text-axis-core/50">
        Every field here already resolves to a confirmed ClickUp custom field for this request
        type -- pick which ones belong on the document, then place them below.
      </p>

      {available.length === 0 ? (
        <p className="mt-3 text-xs text-axis-core/50">Every known field is already in this mapping.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {available.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs text-axis-core/80">
                <input
                  type="checkbox"
                  checked={selected.has(f.key)}
                  onChange={() => toggle(f.key)}
                  className="h-3.5 w-3.5"
                />
                {f.label}
                {f.kind === "dropdown" && <span className="text-axis-core/40">(dropdown)</span>}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={addSelected}
            disabled={selected.size === 0}
            className="mt-3 rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-40"
          >
            Add {selected.size > 0 ? selected.size : ""} field{selected.size === 1 ? "" : "s"}
          </button>
        </>
      )}
    </div>
  );
}
