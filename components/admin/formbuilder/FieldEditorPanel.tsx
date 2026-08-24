"use client";

import { useState } from "react";
import { FIELD_TYPE_META, FIELD_TYPE_OPTIONS } from "@/lib/dynamicForms/fieldTypeMeta";
import type { DynamicField, DynamicFieldType } from "@/lib/dynamicForms/types";
import { FieldTypeIcon } from "./FieldTypeIcon";

const inputClass =
  "w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

interface FieldEditorPanelProps {
  field: DynamicField;
  isNew: boolean;
  onChange: (patch: Partial<DynamicField>) => void;
  onClose: () => void;
  onDelete: () => void;
  /** True for a locked form's code-defined field: its internal name, type,
   *  and options (when it's a dropdown wired to a specific ClickUp field)
   *  are fixed in code and can't be edited here — only copy and
   *  required-ness can. */
  isCodeManaged?: boolean;
}

/** ClickUp-style right-hand slide-over for configuring a single form field. */
export function FieldEditorPanel({ field, isNew, onChange, onClose, onDelete, isCodeManaged }: FieldEditorPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const meta = FIELD_TYPE_META[field.fieldType];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close field editor"
        onClick={onClose}
        className="absolute inset-0 bg-axis-core/30"
      />

      <div className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-axis-base/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-axis-light text-axis-core/70">
              <FieldTypeIcon type={field.fieldType} />
            </span>
            {isCodeManaged ? (
              <span className="truncate text-sm font-semibold text-axis-core">{meta.label}</span>
            ) : (
              <select
                value={field.fieldType}
                onChange={(e) => onChange({ fieldType: e.target.value as DynamicFieldType })}
                className="truncate rounded-[6px] border-0 bg-transparent py-1 text-sm font-semibold text-axis-core focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
              >
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-[6px] px-2 py-1 text-axis-core/50 hover:bg-axis-light hover:text-axis-core"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isCodeManaged && (
            <p className="mb-4 rounded-[8px] bg-axis-light/70 px-3.5 py-2.5 text-xs text-axis-core/60">
              This question is defined in code (it&rsquo;s wired to ClickUp). You can edit its wording,
              description, and required state — its internal name, type{meta.hasOptions ? ", and options" : ""}{" "}
              stay fixed.
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
              {meta.isLayoutOnly ? "Text" : "Field name"}
              {!meta.isLayoutOnly && <span className="text-red-600"> *</span>}
            </span>
            <input
              autoFocus
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Enter name..."
              className={inputClass}
            />
          </label>

          {!meta.isLayoutOnly && (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                Internal field name
              </span>
              <input
                value={field.fieldKey}
                onChange={(e) => onChange({ fieldKey: e.target.value })}
                placeholder="e.g. investorName"
                disabled={isCodeManaged}
                className={`${inputClass} font-mono text-xs ${isCodeManaged ? "cursor-not-allowed opacity-60" : ""}`}
              />
              <span className="mt-1 block text-xs text-axis-core/40">
                {isCodeManaged
                  ? "Fixed — this is how the code maps this question's answer to ClickUp."
                  : "Used internally to key this field's value — not shown to requesters."}
              </span>
            </label>
          )}

          {meta.hasPlaceholder && (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Placeholder</span>
              <input
                value={field.placeholder}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                className={inputClass}
              />
            </label>
          )}

          {meta.hasDefaultValue && (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Default value</span>
              <input
                value={field.defaultValue}
                onChange={(e) => onChange({ defaultValue: e.target.value })}
                className={inputClass}
              />
            </label>
          )}

          {meta.hasOptions && isCodeManaged && (
            <div className="mt-4">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Options (fixed)</span>
              <div className="flex flex-wrap gap-1.5">
                {field.options.map((o, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-axis-base/40 bg-axis-light/40 px-2.5 py-1 text-xs text-axis-core/60"
                  >
                    {o.label}
                  </span>
                ))}
              </div>
              <span className="mt-1.5 block text-xs text-axis-core/40">
                Mapped to specific ClickUp option values in code — ask engineering to change these.
              </span>
            </div>
          )}

          {meta.hasOptions && !isCodeManaged && (
            <div className="mt-4">
              <OptionsEditor options={field.options} onChange={(options) => onChange({ options })} />
            </div>
          )}

          <div className="mt-5 border-t border-axis-base/20 pt-4">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold text-axis-core"
            >
              More settings and permissions
              <span className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {moreOpen && (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Description</span>
                  <input
                    value={field.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="Tell requesters how to use this field"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Example text</span>
                  <input
                    value={field.exampleText}
                    onChange={(e) => onChange({ exampleText: e.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Field width</span>
                  <select
                    value={field.columnSpan}
                    onChange={(e) => onChange({ columnSpan: e.target.value as "half" | "full" })}
                    className={inputClass}
                  >
                    <option value="half">Half (2-column grid)</option>
                    <option value="full">Full width</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                    Validation rules (advanced — raw JSON, optional)
                  </span>
                  <textarea
                    value={field.validationRules}
                    onChange={(e) => onChange({ validationRules: e.target.value })}
                    rows={2}
                    placeholder='e.g. {"minLength": 3, "pattern": "^[A-Z].*"}'
                    className={`${inputClass} font-mono text-xs`}
                  />
                </label>
              </div>
            )}
          </div>

          {!meta.isLayoutOnly && (
            <div className="mt-5 flex items-center justify-between border-t border-axis-base/20 pt-4">
              <span className="text-sm text-axis-core/80">Required</span>
              <button
                type="button"
                role="switch"
                aria-checked={field.isRequired}
                onClick={() => onChange({ isRequired: !field.isRequired })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  field.isRequired ? "bg-axis-core" : "bg-axis-base/50"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    field.isRequired ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-axis-base/20 px-5 py-4">
          <button
            type="button"
            onClick={onDelete}
            className={
              isCodeManaged
                ? "rounded-[8px] border border-axis-base/50 px-3.5 py-2 text-sm font-semibold text-axis-core/70 hover:border-axis-core"
                : "rounded-[8px] border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 hover:border-red-400"
            }
          >
            {isCodeManaged ? "Reset to default" : "Delete"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-axis-base/50 px-4 py-2 text-sm font-semibold text-axis-core hover:border-axis-core"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white hover:bg-axis-core/90"
            >
              {isNew ? "Create" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: DynamicField["options"];
  onChange: (options: DynamicField["options"]) => void;
}) {
  function updateOption(i: number, patch: Partial<{ label: string; value: string }>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addOption() {
    onChange([...options, { label: "", value: "" }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-axis-core/80">Options</span>
        <button
          type="button"
          onClick={addOption}
          className="rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-semibold text-axis-core hover:border-axis-core"
        >
          + Add option
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {options.length === 0 && <p className="text-xs text-axis-core/45">No options yet.</p>}
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={option.label}
              onChange={(e) => updateOption(i, { label: e.target.value })}
              placeholder="Label shown to the user"
              className={`${inputClass} py-2`}
            />
            <input
              value={option.value}
              onChange={(e) => updateOption(i, { value: e.target.value })}
              placeholder="Stored value"
              className={`${inputClass} py-2`}
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              aria-label="Remove option"
              className="shrink-0 rounded-[6px] px-2 py-2 text-xs text-red-700 hover:bg-red-50"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
