"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestTypeConfig } from "@/lib/requestTypes";
import type { AttachmentInput } from "@/lib/types";

interface RequestModalProps {
  requestType: RequestTypeConfig;
  onClose: () => void;
}

type SubmitState = "idle" | "uploading" | "submitting" | "success" | "error";

export function RequestModal({ requestType, onClose }: RequestModalProps) {
  const [requestorName, setRequestorName] = useState("");
  const [requestorEmail, setRequestorEmail] = useState("");
  const [investorName, setInvestorName] = useState("");
  const [dealName, setDealName] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitting = state === "uploading" || state === "submitting";

  async function uploadAttachments(): Promise<AttachmentInput[]> {
    if (files.length === 0) return [];

    const supabase = getSupabaseBrowserClient();
    const uploaded: AttachmentInput[] = [];

    for (const file of files) {
      const path = `${requestType.slug}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) {
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }

      const { data } = supabase.storage.from("attachments").getPublicUrl(path);

      uploaded.push({
        fileName: file.name,
        fileUrl: data.publicUrl,
        fileSize: file.size,
        contentType: file.type,
      });
    }

    return uploaded;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      setState("uploading");
      const attachments = await uploadAttachments();

      setState("submitting");
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: requestType.slug,
          requestorName,
          requestorEmail,
          investorName,
          dealName,
          notes,
          attachments,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong submitting the request.");
      }

      setState("success");
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-axis-core/50 px-4 py-8 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card bg-white shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-axis-base/30 px-7 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
              Process Request
            </p>
            <h2 className="mt-1.5 font-head text-lg font-medium tracking-tight text-axis-core">
              {requestType.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[6px] p-1.5 text-axis-core/50 transition-colors hover:bg-axis-light hover:text-axis-core"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 4L14 14M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {state === "success" ? (
          <div className="px-7 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-axis-signal">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M5 11.5L9 15.5L17 6.5"
                  stroke="#201C1A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 font-head text-base font-medium text-axis-core">
              Request submitted
            </h3>
            <p className="mt-1 text-sm text-axis-core/65">
              Your {requestType.name.toLowerCase()} has been logged.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-axis-core/90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-7 py-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Requestor Name" required>
                <input
                  required
                  type="text"
                  value={requestorName}
                  onChange={(e) => setRequestorName(e.target.value)}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </Field>
              <Field label="Requestor Email" required>
                <input
                  required
                  type="email"
                  value={requestorEmail}
                  onChange={(e) => setRequestorEmail(e.target.value)}
                  className={inputClass}
                  placeholder="jane@axiskey.com"
                />
              </Field>
              <Field label="Investor Name">
                <input
                  type="text"
                  value={investorName}
                  onChange={(e) => setInvestorName(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Deal Name">
                <input
                  type="text"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="Add any details this process needs..."
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Attachments">
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="block w-full text-sm text-axis-core/70 file:mr-3 file:rounded-[6px] file:border-0 file:bg-axis-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-axis-core hover:file:bg-axis-base/40"
                />
              </Field>
            </div>

            {state === "error" && (
              <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="mt-7 flex items-center justify-end gap-3 border-t border-axis-base/30 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[8px] px-4 py-2.5 text-sm font-semibold text-axis-core/70 transition-colors hover:bg-axis-light"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-[8px] bg-axis-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-axis-signal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "uploading"
                  ? "Uploading..."
                  : state === "submitting"
                    ? "Submitting..."
                    : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 transition-colors focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
        {label}
        {required && <span className="text-axis-core/40"> *</span>}
      </span>
      {children}
    </label>
  );
}
