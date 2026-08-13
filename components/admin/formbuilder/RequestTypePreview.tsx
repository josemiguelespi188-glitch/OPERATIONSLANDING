"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { DynamicFormRenderer } from "@/components/dynamic-forms/DynamicFormRenderer";
import type { RequestTypeDetail } from "@/lib/dynamicForms/types";

export function RequestTypePreview({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const [detail, setDetail] = useState<RequestTypeDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/request-types/${id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${body.error ?? "Failed to load."} (status ${res.status})`);
        setDetail(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-16">
        <Link href={`/admin/forms/${id}`} className="text-sm text-axis-core/50 hover:text-axis-core">
          ← Back to editor
        </Link>
        <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-16">
        <p className="text-sm text-axis-core/50">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-[1000px] px-6 pt-6">
        <Link href={`/admin/forms/${id}`} className="text-sm text-axis-core/50 hover:text-axis-core">
          ← Back to editor
        </Link>
      </div>
      <DynamicFormRenderer
        title={detail.name}
        description={detail.description}
        fields={detail.fields}
        buttonLabel={detail.buttonLabel}
        previewMode
      />
    </div>
  );
}
