import Link from "next/link";
import type { RequestTypeConfig, RequestTypeSlug } from "@/lib/requestTypes";
import { FileIcon } from "@/components/layout/icons";

interface RequestCardProps {
  type: RequestTypeConfig;
  onOpen: (slug: RequestTypeConfig["slug"]) => void;
}

const buttonClass =
  "block w-full rounded-[6px] bg-axis-signal px-3 py-1.5 text-center text-xs font-bold text-axis-core transition-colors hover:bg-axis-signal/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-axis-core focus-visible:ring-offset-2";

/** Slugs with a dedicated page under app/forms/<slug> instead of the generic modal. */
// Every current request type has a dedicated page — this stays a Set
// (rather than assuming so unconditionally) so a future new type without
// one yet falls back to the generic RequestModal automatically.
const DEDICATED_FORM_SLUGS = new Set<RequestTypeSlug>([
  "title-transfer-request",
  "redemption-request",
  "ira-funding-request",
  "refund-request",
  "side-letter-request",
  "investor-information-update",
  "account-maintenance-request",
  "document-request",
  "axiskey-report-request",
]);

export function RequestCard({ type, onOpen }: RequestCardProps) {
  const hasDedicatedForm = DEDICATED_FORM_SLUGS.has(type.slug);

  return (
    <div className="flex flex-col rounded-card border border-axis-base/30 bg-white p-3.5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-axis-core">
        <FileIcon className="h-[16px] w-[16px] text-axis-signal" />
      </div>

      <h3 className="mt-2.5 font-head text-sm font-semibold leading-tight tracking-tight text-axis-core">
        {type.name}
      </h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-axis-core/60">
        {type.description}
      </p>

      <div className="mt-3">
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
    </div>
  );
}
