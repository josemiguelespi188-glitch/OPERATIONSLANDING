"use client";

import { useState } from "react";
import type { DynamicField } from "@/lib/dynamicForms/types";

/**
 * Renders a field list built in the Form Builder, in the same visual
 * system as the AxisKey public forms (underline accent, two-column grid,
 * red required asterisk, dashed file dropzone). Deliberately a separate
 * component tree from components/axiskey-forms/FormShell.tsx — used for
 * the admin Preview screen today, and reusable later by the public
 * dynamic-form route (Phase 4) once that exists.
 *
 * previewMode disables real interaction where there's nowhere to submit
 * to yet (file uploads) and shows a "preview only" banner instead of a
 * working submit button.
 */
export function DynamicFormRenderer({
  title,
  description,
  fields,
  buttonLabel,
  previewMode = false,
}: {
  title: string;
  description: string;
  fields: DynamicField[];
  buttonLabel: string;
  previewMode?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMultiValue(key: string, value: string) {
    setMultiValues((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1000px] px-6 py-16 text-left">
        {previewMode && (
          <div className="mb-6 rounded-[6px] border border-axis-signal bg-axis-signal/20 px-3 py-2 text-xs font-semibold text-axis-core">
            Preview only — not connected to ClickUp or the live site yet.
          </div>
        )}

        <div className="mb-6 h-1 w-10 bg-black" />
        <h1 className="text-[28px] font-bold text-black sm:text-[32px]">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[15px] text-gray-600">{description}</p>
        )}

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2"
        >
          {fields.map((field, i) => (
            <FieldBlock
              key={field.id ?? i}
              field={field}
              value={values[field.fieldKey] ?? ""}
              multiValue={multiValues[field.fieldKey] ?? []}
              onChange={(v) => setValue(field.fieldKey, v)}
              onToggleMulti={(v) => toggleMultiValue(field.fieldKey, v)}
              previewMode={previewMode}
            />
          ))}

          {fields.length === 0 && (
            <p className="sm:col-span-2 text-sm text-gray-500">
              No fields added yet.
            </p>
          )}

          <div className="sm:col-span-2 mt-2">
            <button
              type="submit"
              disabled={previewMode}
              className="w-full rounded-[6px] bg-black py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buttonLabel || "Submit"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-[6px] border border-gray-200 bg-white px-[12px] py-[12px] text-sm text-black placeholder:text-gray-300 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-black/10";

function FieldBlock({
  field,
  value,
  multiValue,
  onChange,
  onToggleMulti,
  previewMode,
}: {
  field: DynamicField;
  value: string;
  multiValue: string[];
  onChange: (value: string) => void;
  onToggleMulti: (value: string) => void;
  previewMode: boolean;
}) {
  const fullWidth = field.columnSpan === "full";
  const wrapperClass = fullWidth ? "sm:col-span-2" : undefined;

  if (field.fieldType === "section_divider") {
    return (
      <div className="sm:col-span-2 border-t border-gray-200 pt-4">
        <h2 className="text-base font-bold text-black">{field.label}</h2>
        {field.description && <p className="mt-1 text-sm text-gray-600">{field.description}</p>}
      </div>
    );
  }

  if (field.fieldType === "instructions" || field.fieldType === "readonly_info") {
    return (
      <div
        className={`sm:col-span-2 rounded-[6px] px-4 py-3 text-sm ${
          field.fieldType === "readonly_info"
            ? "border border-gray-200 bg-gray-50 text-gray-700"
            : "text-gray-600"
        }`}
      >
        {field.label && <p className="font-semibold text-black">{field.label}</p>}
        {field.description && <p className="mt-1">{field.description}</p>}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label className="block text-[15px] font-bold text-black">
        {field.label}
        {field.isRequired && <span className="text-red-600">*</span>}
      </label>
      {field.description && <p className="mt-1 text-xs text-gray-500">{field.description}</p>}

      <div className="mt-2">
        {(field.fieldType === "short_text" ||
          field.fieldType === "phone" ||
          field.fieldType === "currency") && (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        )}

        {field.fieldType === "email" && (
          <input
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        )}

        {field.fieldType === "number" && (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        )}

        {field.fieldType === "date" && (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        )}

        {field.fieldType === "long_text" && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={5}
            className={inputClass}
          />
        )}

        {field.fieldType === "dropdown" && (
          <div className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`${inputClass} appearance-none pr-9`}
            >
              <option value="" disabled hidden>
                {field.placeholder || "Select an option"}
              </option>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {field.fieldType === "radio" && (
          <div className="space-y-2">
            {field.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-black">
                <input
                  type="radio"
                  name={field.fieldKey}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="h-4 w-4 border-gray-300"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {field.fieldType === "multi_select" && (
          <div className="space-y-2">
            {field.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-black">
                <input
                  type="checkbox"
                  checked={multiValue.includes(opt.value)}
                  onChange={() => onToggleMulti(opt.value)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {field.fieldType === "checkbox" && (
          <label className="flex items-center gap-2 text-sm text-black">
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(e) => onChange(e.target.checked ? "true" : "")}
              className="h-4 w-4 rounded border-gray-300"
            />
            {field.placeholder || "Yes"}
          </label>
        )}

        {field.fieldType === "file_upload" && (
          <div
            aria-disabled={previewMode}
            className="flex h-[110px] flex-col items-center justify-center rounded-[6px] border border-dashed border-gray-300 px-4 text-center text-sm text-gray-400"
          >
            <span>
              Drop your files here to <span className="text-gray-500 underline">upload</span>
            </span>
          </div>
        )}
      </div>

      {field.exampleText && (
        <p className="mt-1.5 text-xs text-gray-400">Example: {field.exampleText}</p>
      )}
    </div>
  );
}
