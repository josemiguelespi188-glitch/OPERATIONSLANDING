import type { DynamicFieldType } from "@/lib/dynamicForms/types";

const PATHS: Record<DynamicFieldType, string> = {
  short_text: "M4 7h16M4 12h10M4 17h7",
  long_text: "M4 6h16M4 10h16M4 14h16M4 18h10",
  email: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone: "M6 3h4l1.5 4.5L9 9.5a12 12 0 0 0 5.5 5.5l2-2.5L21 14v4a2 2 0 0 1-2 2c-8 0-15-7-15-15a2 2 0 0 1 2-2Z",
  number: "M6 3 5 21M14 3l-1 18M4 8h16M3 16h16",
  currency: "M12 3v18M8 7.5c0-1.4 1.6-2.5 4-2.5s4 1 4 2.5-1.6 2-4 2.5-4 1-4 2.5 1.6 2.5 4 2.5 4-1.1 4-2.5",
  date: "M5 5h14v15H5V5Zm0 5h14M8 3v4M16 3v4M9 14h.01M12 14h.01M15 14h.01",
  dropdown: "M5 7h14M5 12h14M5 17h14M17 7l2 0M17 17l2 0",
  multi_select: "M4 5h4v4H4V5Zm0 10h4v4H4v-4ZM11 6h9M11 17h9M4.5 6.5l1 1 2-2",
  checkbox: "M5 5h14v14H5V5Zm3 7 2.5 2.5L16 9",
  radio: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  file_upload: "M12 3v12m0-12 4 4m-4-4-4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  section_divider: "M4 12h4M10 12h4M16 12h4M4 6h16M4 18h16",
  instructions: "M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4Zm-2 9 1.5 1.5L15 10",
  readonly_info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v5m0-8h.01",
};

export function FieldTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: DynamicFieldType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[type]} />
    </svg>
  );
}
