"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { DocumentMappingManager } from "./DocumentMappingManager";
import { GenerateTab } from "./GenerateTab";
import type { DocumentTemplateSummary } from "@/lib/documentGenerator/types";

type Tab = "generate" | "mapping";

interface RequestTypeInfo {
  id: string;
  slug: string;
  name: string;
}

export function DocumentTemplateWorkspace({ requestTypeId }: { requestTypeId: string }) {
  const adminFetch = useAdminFetch();
  const [requestType, setRequestType] = useState<RequestTypeInfo | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplateSummary[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("generate");

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/request-types/${requestTypeId}/document-templates`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load this request type.");
      setRequestType(body.requestType);
      setTemplates(body.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this request type.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTypeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Link href="/admin/forms" className="text-xs font-medium text-axis-core/50 hover:text-axis-core">
        ← Form Builder
      </Link>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-axis-core/50">
        Generate Document
      </p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
        {requestType?.name ?? "Request type"}
      </h1>

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {templates === null && !error && (
        <p className="mt-10 text-center text-sm text-axis-core/50">Loading...</p>
      )}

      {templates !== null && (
        <>
          <div className="mt-6 flex gap-1 border-b border-axis-base/30">
            {(
              [
                ["generate", "1. Generate"],
                ["mapping", "2. Mapping"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === key ? "border-axis-core text-axis-core" : "border-transparent text-axis-core/50 hover:text-axis-core"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === "generate" ? (
              <GenerateTab requestTypeId={requestTypeId} templates={templates} />
            ) : (
              <DocumentMappingManager requestTypeId={requestTypeId} templates={templates} onChanged={load} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
