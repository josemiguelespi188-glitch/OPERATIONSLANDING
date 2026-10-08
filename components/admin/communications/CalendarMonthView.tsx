"use client";

import type { CommunicationStatus, CommunicationSummary } from "@/lib/communications/types";

const STATUS_DOT: Record<CommunicationStatus, string> = {
  building: "bg-axis-core/30",
  pending_approval: "bg-axis-signal",
  changes_requested: "bg-red-500",
  ready_for_launch: "bg-green-500",
  deployed: "bg-axis-core",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarMonthView({
  monthDate,
  items,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
  onItemClick,
}: {
  monthDate: Date;
  items: CommunicationSummary[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDayClick: (dateKey: string) => void;
  onItemClick: (id: string) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const byDay = new Map<string, CommunicationSummary[]>();
  for (const item of items) {
    if (!item.sendDate) continue;
    if (!byDay.has(item.sendDate)) byDay.set(item.sendDate, []);
    byDay.get(item.sendDate)!.push(item);
  }

  const todayKey = toDateKey(new Date());

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-axis-core">
          {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToday}
            className="rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-medium text-axis-core transition-colors hover:border-axis-signal hover:bg-axis-signal/30"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="rounded-[6px] border border-axis-base/50 px-2 py-1 text-xs font-medium text-axis-core transition-colors hover:border-axis-signal hover:bg-axis-signal/30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            className="rounded-[6px] border border-axis-base/50 px-2 py-1 text-xs font-medium text-axis-core transition-colors hover:border-axis-signal hover:bg-axis-signal/30"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-axis-base/20 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-axis-core/50">
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === month;
          const dayItems = byDay.get(key) ?? [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(key)}
              className={`flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-axis-base/15 p-1.5 text-left transition-colors hover:bg-axis-signal/15 ${
                (i + 1) % 7 === 0 ? "border-r-0" : ""
              } ${inMonth ? "bg-white" : "bg-axis-light/30"}`}
            >
              <span
                className={`self-start rounded-full px-1.5 text-[11px] font-semibold ${
                  key === todayKey ? "bg-axis-signal text-axis-core" : inMonth ? "text-axis-core/70" : "text-axis-core/30"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {dayItems.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    role="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(item.id);
                    }}
                    className="flex items-center gap-1 truncate rounded-[4px] bg-axis-light px-1 py-0.5 text-[10px] font-medium text-axis-core transition-colors hover:bg-axis-signal"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[item.status]}`} />
                    <span className="truncate">{item.title}</span>
                  </span>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[10px] font-medium text-axis-core/40">+{dayItems.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
