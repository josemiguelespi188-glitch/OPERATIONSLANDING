import Link from "next/link";
import type { RequestTypeConfig, RequestTypeSlug } from "@/lib/requestTypes";

interface RequestCardProps {
  type: RequestTypeConfig;
  onOpen: (slug: RequestTypeConfig["slug"]) => void;
}

const buttonClass =
  "mt-7 inline-flex w-full items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-axis-signal focus-visible:ring-offset-2";

/** Slugs with a dedicated page under app/forms/<slug> instead of the generic modal. */
const DEDICATED_FORM_SLUGS = new Set<RequestTypeSlug>([
  "ira-funding-request",
  "title-transfer-request",
  "redemption-request",
]);

export function RequestCard({ type, onOpen }: RequestCardProps) {
  const hasDedicatedForm = DEDICATED_FORM_SLUGS.has(type.slug);

  return (
    <div className="flex flex-col justify-between rounded-card border border-axis-base/40 bg-white p-7 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-axis-signal/70 hover:shadow-card-hover">
      <div>
        <h3 className="font-head text-base font-medium tracking-tight text-axis-core">
          {type.name}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-axis-core/65">
          {type.description}
        </p>
      </div>
      {hasDedicatedForm ? (
        <Link href={`/forms/${type.slug}`} className={buttonClass}>
          {type.buttonLabel}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen(type.slug)} className={buttonClass}>
          {type.buttonLabel}
        </button>
      )}
    </div>
  );
}
