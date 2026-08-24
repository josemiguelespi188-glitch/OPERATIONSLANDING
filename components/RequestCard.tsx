import Link from "next/link";
import type { RequestTypeConfig, RequestTypeSlug } from "@/lib/requestTypes";

interface RequestCardProps {
  type: RequestTypeConfig;
  onOpen: (slug: RequestTypeConfig["slug"]) => void;
}

const buttonClass =
  "block w-full rounded-[8px] bg-axis-signal px-4 py-2.5 text-center text-sm font-bold text-axis-core transition-colors hover:bg-axis-signal/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-axis-core focus-visible:ring-offset-2";

/** Slugs with a dedicated page under app/forms/<slug> instead of the generic modal. */
const DEDICATED_FORM_SLUGS = new Set<RequestTypeSlug>([
  "ira-funding-request",
  "title-transfer-request",
  "redemption-request",
  "side-letter-request",
  "investor-information-update",
  "account-maintenance-request",
  "custom-request",
  "axiskey-report-request",
]);

export function RequestCard({ type, onOpen }: RequestCardProps) {
  const hasDedicatedForm = DEDICATED_FORM_SLUGS.has(type.slug);

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-axis-base/30 bg-white shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="relative h-20 overflow-hidden bg-axis-core">
        <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-axis-signal/20 blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)]" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-head text-base font-semibold tracking-tight text-axis-core">
          {type.name}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-axis-core/65">
          {type.description}
        </p>

        <div className="mt-6">
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
    </div>
  );
}
