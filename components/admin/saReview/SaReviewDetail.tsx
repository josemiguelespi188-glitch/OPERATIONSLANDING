"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { downloadBlobResponse } from "@/lib/utils/downloadBlob";
import type { SaReviewFinding, SaReviewFindingStatus } from "@/lib/services/saReview/checklist";

interface SaReviewDetailData {
  id: string;
  fileName: string;
  status: "analyzing" | "completed" | "failed";
  mappingReady: boolean | null;
  findings: SaReviewFinding[];
  hasFormattedFile: boolean;
  error: string | null;
  createdAt: string;
}

export function SaReviewDetail({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const [review, setReview] = useState<SaReviewDetailData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/sa-review/${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load this review.");
      setReview(body.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this review.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFormat() {
    setBusy(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/${id}/format`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to format the document.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to format the document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(variant: "original" | "formatted") {
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/${id}/download?variant=${variant}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to download the file.");
      }
      await downloadBlobResponse(res, `${variant}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download the file.");
    }
  }

  async function handleReport() {
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/${id}/report`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate the report.");
      }
      await downloadBlobResponse(res, "sa-review-report.pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the report.");
    }
  }

  if (!review && !error) {
    return <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>;
  }

  const hasAutoFix = review?.findings.some((f) => f.status === "auto_fix") ?? false;

  return (
    <div>
      <Link href="/admin/sa-review" className="text-xs font-semibold text-axis-core/50 hover:text-axis-core">
        ← Back to SA Review
      </Link>

      {review && (
        <>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-head text-2xl font-medium tracking-tight text-axis-core">
                {review.fileName}
              </h1>
              <p className="mt-1 text-xs text-axis-core/50">
                Reviewed {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handleDownload("original")}
                className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
              >
                Download original
              </button>
              {review.status === "completed" && (
                <button
                  type="button"
                  onClick={handleReport}
                  className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
                >
                  Export report (PDF)
                </button>
              )}
            </div>
          </div>

          {review.status === "analyzing" && (
            <p className="mt-6 rounded-[8px] bg-axis-light px-4 py-3 text-sm text-axis-core/70">
              Still analyzing this document.
            </p>
          )}

          {review.status === "failed" && (
            <p className="mt-6 rounded-[8px] bg-red-50 px-4 py-3 text-sm text-red-700">
              Review failed: {review.error ?? "Unknown error."}
            </p>
          )}

          {review.status === "completed" && (
            <>
              <div
                className={`mt-6 rounded-card px-5 py-4 ${
                  review.mappingReady ? "bg-axis-signal/20" : "bg-amber-50"
                }`}
              >
                <p className="text-sm font-semibold text-axis-core">
                  {review.mappingReady
                    ? "Mapping ready: no legal content issues require human review."
                    : "Not mapping ready: one or more items below need human review."}
                </p>
                {hasAutoFix && (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleFormat}
                      className="inline-flex items-center justify-center rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-50"
                    >
                      {busy ? "Formatting..." : "Format document"}
                    </button>
                    <p className="text-xs text-axis-core/60">
                      Widens blanks and fixes alignment only. Dates, TBDs, and other content
                      issues are never auto-corrected.
                    </p>
                  </div>
                )}
                {review.hasFormattedFile && (
                  <button
                    type="button"
                    onClick={() => handleDownload("formatted")}
                    className="mt-3 rounded-[6px] border border-axis-base/50 bg-white px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
                  >
                    Download formatted document
                  </button>
                )}
              </div>

              <div className="mt-6 overflow-hidden rounded-card border border-axis-base/30 bg-white">
                {review.findings.map((finding, i) => (
                  <div
                    key={finding.category}
                    className={`flex gap-4 px-5 py-4 ${i !== 0 ? "border-t border-axis-base/20" : ""}`}
                  >
                    <div className="w-72 shrink-0">
                      <p className="text-sm font-semibold text-axis-core">
                        {finding.category}. {finding.label}
                      </p>
                      <FindingBadge status={finding.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-axis-core/80">{finding.detail}</p>
                      {finding.recommendedAction && (
                        <p className="mt-1.5 text-sm text-axis-core/60">
                          <span className="font-semibold text-axis-core/80">Recommended action: </span>
                          {finding.recommendedAction}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function FindingBadge({ status }: { status: SaReviewFindingStatus }) {
  const styles: Record<SaReviewFindingStatus, string> = {
    ok: "bg-axis-signal text-axis-core",
    auto_fix: "bg-amber-50 text-amber-700",
    flag: "bg-red-50 text-red-700",
  };
  const labels: Record<SaReviewFindingStatus, string> = {
    ok: "OK",
    auto_fix: "Auto-fixable",
    flag: "Needs review",
  };
  return (
    <span className={`mt-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
