"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RequestFormConfig } from "@/lib/requestFormConfigs";
import type { AttachmentInput } from "@/lib/types";
import {
  FieldShell,
  FileDropzone,
  SelectField,
  TextField,
  TextareaField,
} from "./FormPrimitives";

/**
 * Maps this form's rich, form-specific fields onto the shared
 * requests/payload shape (requestorName, requestorEmail, investorName,
 * dealName) so the existing Supabase + ClickUp pipeline needs no changes.
 * Every field is still preserved verbatim in `notes` (see buildNotes).
 */
const FIELD_MAP: Record<
  string,
  {
    requestorName: string;
    requestorEmail: string | string[];
    investorName: string;
    dealName: string;
  }
> = {
  "ira-funding-request": {
    requestorName: "investorAccountName",
    requestorEmail: "ccEmail",
    investorName: "investorAccountName",
    dealName: "dealName",
  },
  "title-transfer-request": {
    requestorName: "investorName",
    requestorEmail: ["requesterEmail", "investorEmail"],
    investorName: "investorName",
    dealName: "dealName",
  },
  "redemption-request": {
    requestorName: "investorName",
    requestorEmail: "investorEmail",
    investorName: "investorAccountName",
    dealName: "offeringName",
  },
};

function resolveEmail(values: Record<string, string>, key: string | string[]): string {
  const keys = Array.isArray(key) ? key : [key];
  for (const k of keys) {
    if (values[k]?.trim()) return values[k].trim();
  }
  return "";
}

function buildNotes(config: RequestFormConfig, values: Record<string, string>): string {
  return config.fields
    .filter((field) => field.type !== "file")
    .map((field) => `${field.label}: ${values[field.id]?.trim() || "—"}`)
    .join("\n");
}

type SubmitState = "idle" | "uploading" | "submitting" | "success" | "error";

export function DetailedRequestForm({ config }: { config: RequestFormConfig }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitting = state === "uploading" || state === "submitting";

  function setValue(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  async function uploadAttachments(): Promise<AttachmentInput[]> {
    const allFiles = Object.entries(files).flatMap(([fieldId, list]) =>
      list.map((file) => ({ fieldId, file }))
    );
    if (allFiles.length === 0) return [];

    const supabase = getSupabaseBrowserClient();
    const uploaded: AttachmentInput[] = [];

    for (const { fieldId, file } of allFiles) {
      const path = `${config.slug}/${fieldId}/${Date.now()}-${file.name}`;
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

    const map = FIELD_MAP[config.slug];

    try {
      setState("uploading");
      const attachments = await uploadAttachments();

      setState("submitting");
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: config.slug,
          requestorName: values[map.requestorName]?.trim() || "",
          requestorEmail: resolveEmail(values, map.requestorEmail),
          investorName: values[map.investorName]?.trim() || "",
          dealName: values[map.dealName]?.trim() || "",
          notes: buildNotes(config, values),
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
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (state === "success") {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M5 11.5L9 15.5L17 6.5"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-black">Request submitted</h2>
        <p className="mt-1 text-sm text-gray-600">Your {config.title.toLowerCase()} has been logged.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-[6px] bg-black px-5 py-3 text-sm font-bold text-white hover:bg-gray-900"
        >
          Back to Operations Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-12">
      <Link href="/" className="text-xs text-gray-400 hover:text-black">
        ← Back to Operations Hub
      </Link>

      <div className="mb-4 mt-6 h-1.5 w-10 bg-black" />
      <h1 className="text-[28px] font-bold leading-tight text-black sm:text-[32px]">
        {config.title}
      </h1>
      <div className="mt-3 max-w-2xl text-[15px] text-gray-700">
        {config.descriptionLines.map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1" : undefined}>
            {line}
          </p>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-10">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          {config.fields.map((field) => (
            <FieldShell key={field.id} config={field}>
              {field.type === "file" ? (
                <FileDropzone
                  config={field}
                  files={files[field.id] ?? []}
                  onChange={(list) => setFiles((prev) => ({ ...prev, [field.id]: list }))}
                />
              ) : field.type === "select" ? (
                <SelectField
                  config={field}
                  value={values[field.id] ?? ""}
                  onChange={(v) => setValue(field.id, v)}
                />
              ) : field.type === "textarea" ? (
                <TextareaField
                  config={field}
                  value={values[field.id] ?? ""}
                  onChange={(v) => setValue(field.id, v)}
                />
              ) : (
                <TextField
                  config={field}
                  value={values[field.id] ?? ""}
                  onChange={(v) => setValue(field.id, v)}
                />
              )}
            </FieldShell>
          ))}
        </div>

        {state === "error" && (
          <p className="mt-6 rounded-[6px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-10 w-full rounded-[6px] bg-black py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "uploading" ? "Uploading..." : state === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
