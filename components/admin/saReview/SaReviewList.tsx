"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { fileToBase64 } from "@/lib/utils/downloadBlob";

interface SaReviewSummary {
  id: string;
  fileName: string;
  status: "analyzing" | "completed" | "failed";
  mappingReady: boolean | null;
  createdAt: string;
}

export function SaReviewList() {
  const adminFetch = useAdminFetch();
  const [reviews, setReviews] = useState<SaReviewSummary[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/sa-review");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load reviews.");
      setReviews(body.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await adminFetch("/api/admin/sa-review", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileBase64 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to review the document.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review the document.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
        <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">SA Review</h1>
        <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
          Upload a Subscription Agreement to check it against the mapping-readiness checklist.
          Space and alignment issues can be auto-fixed; everything else (dates, TBDs, multiple
          classes, pre-filled commitments, countersignature) is always flagged for human review,
          never auto-corrected.
        </p>
      </div>

      <div className="mt-8 rounded-card border border-dashed border-axis-base/50 bg-white px-6 py-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-50"
        >
          {uploading ? "Reviewing..." : "Upload Subscription Agreement (.docx)"}
        </button>
        {uploading && (
          <p className="mt-3 text-xs text-axis-core/50">
            Extracting document contents and running the mapping-readiness checklist. This can take
            up to a minute.
          </p>
        )}
      </div>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {reviews === null && !error && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>
        )}
        {reviews?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">No SAs reviewed yet.</p>
        )}
        {reviews?.map((review, i) => (
          <Link
            key={review.id}
            href={`/admin/sa-review/${review.id}`}
            className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-axis-cream/60 ${
              i !== 0 ? "border-t border-axis-base/20" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-axis-core">{review.fileName}</p>
              <p className="mt-0.5 text-xs text-axis-core/50">
                {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={review.status} mappingReady={review.mappingReady} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  mappingReady,
}: {
  status: SaReviewSummary["status"];
  mappingReady: boolean | null;
}) {
  if (status === "analyzing") {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-axis-light px-2.5 py-1 text-[11px] font-semibold text-axis-core/60">
        Analyzing...
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
        Failed
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        mappingReady ? "bg-axis-signal text-axis-core" : "bg-amber-50 text-amber-700"
      }`}
    >
      {mappingReady ? "Mapping ready" : "Needs review"}
    </span>
  );
}
