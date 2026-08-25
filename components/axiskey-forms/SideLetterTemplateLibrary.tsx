"use client";

import { SIDE_LETTER_TEMPLATES } from "@/lib/sideLetterTemplates";

export function SideLetterTemplateLibrary({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (templateId: string) => void;
}) {
  return (
    <div className="mt-10">
      <h2 className="text-base font-bold text-axis-core">Common Side Letter Templates</h2>
      <p className="mt-1 text-sm text-axis-core/60">
        Pick a starting point — it prefills the terms description below. You can still edit
        everything before submitting.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SIDE_LETTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={`rounded-[8px] border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              selectedId === template.id
                ? "border-axis-core bg-axis-core text-white"
                : "border-axis-base/50 text-axis-core hover:border-axis-core/50"
            }`}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
}
