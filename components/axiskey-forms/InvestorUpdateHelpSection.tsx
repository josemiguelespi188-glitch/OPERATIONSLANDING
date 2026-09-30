"use client";

const EXAMPLES = [
  "Fund or project milestones",
  "Operational updates",
  "Property updates",
  "Construction progress",
  "Occupancy updates",
  "Leasing activity",
  "Revenue growth",
  "Market developments",
  "Strategic partnerships",
  "New acquisitions",
  "Portfolio highlights",
  "Capital events",
  "Distribution updates",
  "Outlook for the next quarter",
];

/** Purely informational, collapsible — doesn't affect submission. */
export function InvestorUpdateHelpSection() {
  return (
    <details className="group mt-8 rounded-[6px] border border-axis-base/40 bg-axis-light/60 open:pb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-bold text-axis-core">
        What makes a good Investor Update?
        <svg
          className="h-3 w-3 shrink-0 text-axis-core/50 transition-transform group-open:rotate-180"
          viewBox="0 0 12 8"
          fill="none"
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 px-4 text-sm text-axis-core/65 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <li key={example} className="flex gap-2">
            <span className="text-axis-core/35">•</span>
            {example}
          </li>
        ))}
      </ul>
    </details>
  );
}
