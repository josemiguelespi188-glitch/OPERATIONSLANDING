"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { newId } from "@/lib/pdfGenerator/types";
import type { DocumentField, DocumentTemplateConfig } from "@/lib/documentGenerator/types";
import type { KnownClickUpField } from "@/lib/documentGenerator/clickupFields";

interface FieldsResponse {
  all: KnownClickUpField[];
  pinnedIds: string[];
}

/**
 * Sits above MappingEditor in the Mapping tab. Lets the admin add fields
 * sourced from this request type's ClickUp custom fields, or a fixed-
 * text field with no ClickUp source -- removing a field (and its boxes)
 * is handled by MappingEditor's own existing field list, so this
 * component only ever adds.
 *
 * Oct 2026 (second follow-up pass): the main checklist only shows
 * "pinned" fields (request_types.pinned_clickup_fields, shared across
 * every mapping this request type has) -- "View More ClickUp Fields"
 * expands to the FULL live catalog (every field currently on this
 * request type's ClickUp list, not just ones this codebase's own
 * submission sync already uses) with a pin/unpin toggle per field, plus
 * a manual Refresh so a field just created directly in ClickUp shows up
 * without a deploy.
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
  const [data, setData] = useState<FieldsResponse | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/clickup-fields`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load this request type's ClickUp fields.");
      setData(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ClickUp fields.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function togglePin(fieldId: string) {
    if (!data) return;
    const pinnedIds = data.pinnedIds.includes(fieldId)
      ? data.pinnedIds.filter((id) => id !== fieldId)
      : [...data.pinnedIds, fieldId];
    setData({ ...data, pinnedIds }); // optimistic
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/clickup-field-pins`, {
        method: "PATCH",
        body: JSON.stringify({ fieldIds: pinnedIds }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Could not save that pin change -- try again.");
      load();
    }
  }

  const all = data?.all ?? [];
  const pinnedIds = new Set(data?.pinnedIds ?? []);
  const includedIds = new Set(config.fields.map((f) => f.clickUpFieldId).filter(Boolean));
  const pinned = all.filter((f) => pinnedIds.has(f.id) && !includedIds.has(f.id));
  const filterLower = filter.trim().toLowerCase();
  const allFiltered = filterLower ? all.filter((f) => f.label.toLowerCase().includes(filterLower)) : all;

  function toggleSelected(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    const toAdd = pinned.filter((f) => selected.has(f.id));
    if (toAdd.length === 0) return;
    const newFields: DocumentField[] = toAdd.map((f) => ({
      id: newId(),
      label: f.label,
      type: "text",
      sample: "",
      defaultValue: "",
      clickUpFieldId: f.id,
    }));
    onChange({ ...config, fields: [...config.fields, ...newFields] });
    setSelected(new Set());
  }

  function addFixedField() {
    const field: DocumentField = {
      id: newId(),
      label: "Fixed text",
      type: "text",
      sample: "",
      defaultValue: "",
      fixedValue: "",
    };
    onChange({ ...config, fields: [...config.fields, field] });
  }

  if (error && !data) {
    return <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-axis-core/50">Loading ClickUp fields...</p>;
  }

  return (
    <div className="rounded-card border border-axis-base/30 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-axis-core">Add fields from ClickUp</p>
          <p className="mt-1 text-xs text-axis-core/50">
            Pick from this request type&apos;s pinned ClickUp fields, or add a fixed text field that
            always uses the same value. Use &quot;View More ClickUp Fields&quot; to pin anything else
            currently on this request type&apos;s ClickUp list.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-medium text-axis-core/70 transition-colors hover:border-axis-core disabled:opacity-40"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {pinned.length === 0 ? (
        <p className="mt-3 text-xs text-axis-core/50">
          No pinned fields left to add. Pin more from &quot;View More ClickUp Fields&quot; below.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pinned.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-xs text-axis-core/80">
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggleSelected(f.id)}
                  className="h-3.5 w-3.5"
                />
                {f.label}
                {f.kind !== "text" && <span className="text-axis-core/40">({f.kind})</span>}
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

      <button
        type="button"
        onClick={addFixedField}
        className="mt-2 rounded-[6px] border border-dashed border-axis-core/40 px-3 py-1.5 text-xs font-semibold text-axis-core hover:bg-axis-light/60"
      >
        + Add fixed text field
      </button>

      <div className="mt-4 border-t border-axis-base/20 pt-3">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-xs font-semibold text-axis-core underline-offset-2 hover:underline"
        >
          {showMore ? "Hide" : "View More ClickUp Fields"} ({all.length} total on this list)
        </button>

        {showMore && (
          <div className="mt-3">
            {all.length === 0 ? (
              <p className="text-xs text-axis-core/50">
                No ClickUp fields found -- confirm this request type has a list in
                CLICKUP_LIST_ID_MAP and try Refresh.
              </p>
            ) : (
              <>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by name..."
                  className="mb-2 w-full max-w-xs rounded-[6px] border border-axis-base/40 bg-white px-2 py-1 text-xs outline-none focus:border-axis-core"
                />
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-[8px] border border-axis-base/20 p-2">
                  {allFiltered.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                      <span className="truncate text-axis-core/80">
                        {f.label}
                        {f.kind !== "text" && <span className="ml-1 text-axis-core/40">({f.kind})</span>}
                      </span>
                      <label className="flex shrink-0 items-center gap-1.5 text-axis-core/60">
                        <input
                          type="checkbox"
                          checked={pinnedIds.has(f.id)}
                          onChange={() => togglePin(f.id)}
                          className="h-3.5 w-3.5"
                        />
                        Pinned
                      </label>
                    </li>
                  ))}
                  {allFiltered.length === 0 && (
                    <li className="px-1 py-1 text-xs text-axis-core/40">No fields match &quot;{filter}&quot;.</li>
                  )}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
