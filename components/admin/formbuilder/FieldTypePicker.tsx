"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FIELD_TYPE_GROUPS, FIELD_TYPE_META } from "@/lib/dynamicForms/fieldTypeMeta";
import type { DynamicFieldType } from "@/lib/dynamicForms/types";
import { FieldTypeIcon } from "./FieldTypeIcon";

interface FieldTypePickerProps {
  onSelect: (type: DynamicFieldType) => void;
}

/** ClickUp-style "+ Add question" trigger that opens a searchable, categorized type menu. */
export function FieldTypePicker({ onSelect }: FieldTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIELD_TYPE_GROUPS;
    return FIELD_TYPE_GROUPS.map((g) => ({
      group: g.group,
      types: g.types.filter((t) => FIELD_TYPE_META[t].label.toLowerCase().includes(q)),
    })).filter((g) => g.types.length > 0);
  }, [query]);

  function select(type: DynamicFieldType) {
    onSelect(type);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-axis-base bg-axis-light/60 px-4 py-3 text-sm font-semibold text-axis-core transition-colors hover:border-axis-core hover:bg-axis-light"
      >
        <span className="text-base leading-none">+</span> Add question
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[320px] rounded-[10px] border border-axis-base/40 bg-white shadow-xl">
          <div className="border-b border-axis-base/20 p-2.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-[6px] border border-axis-base/40 bg-axis-light/50 px-3 py-2 text-sm text-axis-core placeholder:text-axis-core/40 focus:border-axis-signal focus:outline-none"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1.5">
            {groups.length === 0 && (
              <p className="px-3.5 py-4 text-center text-xs text-axis-core/45">No matches.</p>
            )}
            {groups.map(({ group, types }) => (
              <div key={group} className="py-1">
                <p className="px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-axis-core/40">
                  {group}
                </p>
                {types.map((type) => {
                  const meta = FIELD_TYPE_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => select(type)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-axis-light"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-axis-light text-axis-core/70">
                        <FieldTypeIcon type={type} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-axis-core">
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-axis-core/45">{meta.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
