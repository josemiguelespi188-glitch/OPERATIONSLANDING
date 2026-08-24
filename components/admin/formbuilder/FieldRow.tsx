"use client";

import { FIELD_TYPE_META } from "@/lib/dynamicForms/fieldTypeMeta";
import type { DynamicField } from "@/lib/dynamicForms/types";

const previewInputClass =
  "w-full rounded-[8px] border border-axis-base/40 bg-axis-light/40 px-3.5 py-2.5 text-sm text-axis-core/40";

interface FieldRowProps {
  field: DynamicField;
  index: number;
  total: number;
  onOpen: () => void;
  onMove: (direction: -1 | 1) => void;
}

/**
 * A read-only preview of how the field renders in the real form. Clicking
 * anywhere on the card opens the FieldEditorPanel — this never edits state
 * directly (that's the panel's job), it only renders + reorders.
 */
export function FieldRow({ field, index, total, onOpen, onMove }: FieldRowProps) {
  return (
    <div
      className={`group relative rounded-[8px] border border-axis-base/30 bg-white p-4 transition-colors hover:border-axis-core/40 ${
        field.columnSpan === "full" ? "sm:col-span-2" : ""
      }`}
    >
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(-1);
          }}
          disabled={index === 0}
          aria-label="Move up"
          className="rounded-[6px] bg-white px-1.5 py-1 text-xs text-axis-core/50 shadow-sm ring-1 ring-axis-base/30 hover:text-axis-core disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
          disabled={index === total - 1}
          aria-label="Move down"
          className="rounded-[6px] bg-white px-1.5 py-1 text-xs text-axis-core/50 shadow-sm ring-1 ring-axis-base/30 hover:text-axis-core disabled:opacity-30"
        >
          ↓
        </button>
        <span className="rounded-[6px] bg-white px-2 py-1 text-xs font-semibold text-axis-core shadow-sm ring-1 ring-axis-base/30">
          Edit
        </span>
      </div>

      <button type="button" onClick={onOpen} className="block w-full text-left">
        <FieldPreviewBody field={field} />
      </button>
    </div>
  );
}

function FieldPreviewBody({ field }: { field: DynamicField }) {
  const meta = FIELD_TYPE_META[field.fieldType];
  const label = field.label || "Untitled field";

  if (field.fieldType === "section_divider") {
    return (
      <div className="border-b border-axis-base/40 pb-2">
        <p className="font-head text-base font-medium tracking-tight text-axis-core">{label}</p>
      </div>
    );
  }

  if (field.fieldType === "instructions" || field.fieldType === "readonly_info") {
    return (
      <div className="rounded-[6px] bg-axis-light/50 px-3.5 py-3">
        <p className="text-sm italic text-axis-core/60">{label}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="truncate text-sm font-medium text-axis-core">
        {label}
        {field.isRequired && <span className="ml-0.5 text-red-600">*</span>}
      </p>
      {field.description && (
        <p className="mt-0.5 truncate text-xs text-axis-core/45">{field.description}</p>
      )}

      <div className="mt-2">
        <FieldPreviewInput field={field} />
      </div>

      <p className="mt-2 text-[11px] text-axis-core/35">
        {meta.label}
        {field.fieldKey && ` · ${field.fieldKey}`}
      </p>
    </div>
  );
}

function FieldPreviewInput({ field }: { field: DynamicField }) {
  switch (field.fieldType) {
    case "long_text":
      return (
        <div className={`${previewInputClass} h-16`}>{field.placeholder || "Enter text"}</div>
      );
    case "dropdown":
      return (
        <div className={previewInputClass}>
          {field.placeholder || field.options[0]?.label || "Select an option"} ⌄
        </div>
      );
    case "multi_select":
    case "radio":
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options.length === 0 && (
            <span className="text-xs text-axis-core/35">No options yet</span>
          )}
          {field.options.slice(0, 4).map((o, i) => (
            <span
              key={i}
              className="rounded-full border border-axis-base/40 bg-axis-light/40 px-2.5 py-1 text-xs text-axis-core/50"
            >
              {o.label || "Option"}
            </span>
          ))}
          {field.options.length > 4 && (
            <span className="text-xs text-axis-core/35">+{field.options.length - 4} more</span>
          )}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-xs text-axis-core/45">
          <span className="h-4 w-4 rounded border border-axis-base/50 bg-axis-light/40" />
          {field.placeholder || "Yes"}
        </label>
      );
    case "file_upload":
      return (
        <div className="rounded-[8px] border border-dashed border-axis-base/50 bg-axis-light/30 px-3.5 py-4 text-center text-xs text-axis-core/40">
          Drop files here to upload
        </div>
      );
    case "date":
      return <div className={previewInputClass}>{field.defaultValue || "mm/dd/yyyy"}</div>;
    default:
      return <div className={previewInputClass}>{field.placeholder || "Enter text"}</div>;
  }
}
