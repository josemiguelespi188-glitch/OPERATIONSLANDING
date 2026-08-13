"use client";

import { FIELD_TYPE_META, FIELD_TYPE_OPTIONS } from "@/lib/dynamicForms/fieldTypeMeta";
import type { DynamicField, DynamicFieldType } from "@/lib/dynamicForms/types";

const inputClass =
  "w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

interface FieldRowProps {
  field: DynamicField;
  index: number;
  total: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Partial<DynamicField>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function FieldRow({
  field,
  index,
  total,
  isEditing,
  onToggleEdit,
  onChange,
  onRemove,
  onMove,
}: FieldRowProps) {
  const meta = FIELD_TYPE_META[field.fieldType];

  return (
    <div className="rounded-[8px] border border-axis-base/30">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-axis-core">
            {field.label || <span className="text-axis-core/40">Untitled field</span>}
            {field.isRequired && <span className="ml-1 text-red-600">*</span>}
          </p>
          <p className="truncate text-xs text-axis-core/50">
            {meta.label}
            {field.fieldKey && ` · ${field.fieldKey}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            className="rounded-[6px] px-2 py-1 text-xs text-axis-core/60 hover:bg-axis-light disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="rounded-[6px] px-2 py-1 text-xs text-axis-core/60 hover:bg-axis-light disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onToggleEdit}
            className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core hover:border-axis-core"
          >
            {isEditing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-[6px] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:border-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-axis-base/20 px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Field type</span>
              <select
                value={field.fieldType}
                onChange={(e) => onChange({ fieldType: e.target.value as DynamicFieldType })}
                className={inputClass}
              >
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                Internal field name
              </span>
              <input
                value={field.fieldKey}
                onChange={(e) => onChange({ fieldKey: e.target.value })}
                placeholder="e.g. investorName"
                className={inputClass}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                {meta.isLayoutOnly ? "Text" : "Label"}
              </span>
              <input
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className={inputClass}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                Description / help text shown under the label
              </span>
              <input
                value={field.description}
                onChange={(e) => onChange({ description: e.target.value })}
                className={inputClass}
              />
            </label>

            {meta.hasPlaceholder && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                  Placeholder
                </span>
                <input
                  value={field.placeholder}
                  onChange={(e) => onChange({ placeholder: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}

            {meta.hasDefaultValue && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                  Default value
                </span>
                <input
                  value={field.defaultValue}
                  onChange={(e) => onChange({ defaultValue: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                Example text
              </span>
              <input
                value={field.exampleText}
                onChange={(e) => onChange({ exampleText: e.target.value })}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
                Field width
              </span>
              <select
                value={field.columnSpan}
                onChange={(e) => onChange({ columnSpan: e.target.value as "half" | "full" })}
                className={inputClass}
              >
                <option value="half">Half (2-column grid)</option>
                <option value="full">Full width</option>
              </select>
            </label>

            {!meta.isLayoutOnly && (
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={field.isRequired}
                  onChange={(e) => onChange({ isRequired: e.target.checked })}
                  className="h-4 w-4 rounded border-axis-base/50"
                />
                <span className="text-sm text-axis-core/80">Required</span>
              </label>
            )}

            <label className="block sm:col-span-2">
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

          {meta.hasOptions && (
            <OptionsEditor
              options={field.options}
              onChange={(options) => onChange({ options })}
            />
          )}
        </div>
      )}
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
    <div className="mt-4 border-t border-axis-base/20 pt-4">
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
        {options.length === 0 && (
          <p className="text-xs text-axis-core/45">No options yet.</p>
        )}
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
