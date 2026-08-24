"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import {
  emptyField,
  type DynamicField,
  type DynamicFieldType,
  type RequestTypeDetail,
} from "@/lib/dynamicForms/types";
import { FieldEditorPanel } from "./FieldEditorPanel";
import { FieldRow } from "./FieldRow";
import { FieldTypePicker } from "./FieldTypePicker";

const inputClass =
  "w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

export function RequestTypeEditor({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const [detail, setDetail] = useState<RequestTypeDetail | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openIsNew, setOpenIsNew] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [fieldsSaved, setFieldsSaved] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [isActive, setIsActive] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${id}`);
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`${body.error ?? "Failed to load."} (status ${res.status})`);
      setDetail(body);
      setFields(body.fields);
      setName(body.name);
      setDescription(body.description);
      setButtonLabel(body.buttonLabel);
      setIsActive(body.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings() {
    setSavingSettings(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description, buttonLabel, isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`${body.error ?? "Failed to save settings."} (status ${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveFields() {
    setSavingFields(true);
    setFieldsSaved(false);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/request-types/${id}/fields`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`${body.error ?? "Failed to save fields."} (status ${res.status})`);
      }
      setFieldsSaved(true);
      setOpenIndex(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fields.");
    } finally {
      setSavingFields(false);
    }
  }

  function addField(fieldType: DynamicFieldType) {
    setFields((prev) => [...prev, { ...emptyField(prev.length), fieldType }]);
    setOpenIndex(fields.length);
    setOpenIsNew(true);
  }

  function updateField(index: number, patch: Partial<DynamicField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) =>
      prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, displayOrder: i }))
    );
    setOpenIndex(null);
    setOpenIsNew(false);
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((f, i) => ({ ...f, displayOrder: i }));
    });
  }

  if (notFound) {
    return (
      <div>
        <Link href="/admin/forms" className="text-sm text-axis-core/50 hover:text-axis-core">
          ← Back to Form Builder
        </Link>
        <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
          Request type not found.
        </p>
      </div>
    );
  }

  if (!detail && !error) {
    return <p className="text-sm text-axis-core/50">Loading...</p>;
  }

  if (!detail) {
    return <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (detail.isLocked) {
    return (
      <div>
        <Link href="/admin/forms" className="text-sm text-axis-core/50 hover:text-axis-core">
          ← Back to Form Builder
        </Link>
        <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
          &ldquo;{detail.name}&rdquo; is locked (code-driven) and can&rsquo;t be edited here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/forms" className="text-sm text-axis-core/50 hover:text-axis-core">
        ← Back to Form Builder
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
            Internal
          </p>
          <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
            {detail.name}
          </h1>
          <p className="mt-1 text-xs text-axis-core/45">/{detail.slug}</p>
        </div>
        <Link
          href={`/admin/forms/${id}/preview`}
          className="shrink-0 rounded-[8px] border border-axis-base/50 px-4 py-2.5 text-sm font-semibold text-axis-core transition-colors hover:border-axis-core"
        >
          Preview
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 rounded-card border border-axis-base/30 bg-white p-6">
        <h2 className="font-head text-sm font-medium tracking-tight text-axis-core">
          Request type settings
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
              Submit button label
            </span>
            <input
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
              Card description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-axis-base/50"
            />
            <span className="text-sm text-axis-core/80">
              Active (has no live effect yet — the homepage doesn&rsquo;t read from the
              database until Phase 6)
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={savingSettings}
          className="mt-5 rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-60"
        >
          {savingSettings ? "Saving..." : "Save settings"}
        </button>
      </div>

      <div className="mt-6 rounded-card border border-axis-base/30 bg-white p-6">
        <h2 className="font-head text-sm font-medium tracking-tight text-axis-core">
          Fields ({fields.length})
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field, index) => (
            <FieldRow
              key={index}
              field={field}
              index={index}
              total={fields.length}
              onOpen={() => {
                setOpenIndex(index);
                setOpenIsNew(false);
              }}
              onMove={(dir) => moveField(index, dir)}
            />
          ))}

          <div className="sm:col-span-2">
            <FieldTypePicker onSelect={addField} />
          </div>
        </div>

        {openIndex !== null && fields[openIndex] && (
          <FieldEditorPanel
            field={fields[openIndex]}
            isNew={openIsNew}
            onChange={(patch) => updateField(openIndex, patch)}
            onClose={() => {
              setOpenIndex(null);
              setOpenIsNew(false);
            }}
            onDelete={() => removeField(openIndex)}
          />
        )}

        <button
          type="button"
          onClick={saveFields}
          disabled={savingFields}
          className="mt-5 rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-60"
        >
          {savingFields ? "Saving..." : "Save fields"}
        </button>
        {fieldsSaved && !savingFields && (
          <span className="ml-3 text-xs text-axis-core/50">Saved.</span>
        )}
      </div>
    </div>
  );
}
