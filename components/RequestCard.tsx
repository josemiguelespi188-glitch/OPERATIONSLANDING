import type { RequestTypeConfig } from "@/lib/requestTypes";

interface RequestCardProps {
  type: RequestTypeConfig;
  onOpen: (slug: RequestTypeConfig["slug"]) => void;
}

export function RequestCard({ type, onOpen }: RequestCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-card border border-axis-base/40 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
      <div>
        <h3 className="font-head text-base font-bold tracking-tight text-axis-core">
          {type.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-axis-core/65">
          {type.description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(type.slug)}
        className="mt-6 inline-flex w-full items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-axis-signal focus-visible:ring-offset-2"
      >
        {type.buttonLabel}
      </button>
    </div>
  );
}
