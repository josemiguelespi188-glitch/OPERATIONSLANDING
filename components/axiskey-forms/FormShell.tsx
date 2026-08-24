"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ClickUpSyncNotice } from "@/components/ClickUpSyncNotice";
import type { RequestTypeSlug } from "@/lib/requestTypes";
import type { AttachmentInput } from "@/lib/types";

export type FieldConfig =
  | {
      kind: "text" | "email" | "number" | "currency" | "date";
      name: string;
      label: string;
      required?: boolean;
      helper?: string;
      placeholder: string;
      fullWidth?: boolean;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      required?: boolean;
      helper?: string;
      placeholder: string;
      fullWidth?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      required?: boolean;
      helper?: string;
      placeholder: string;
      options: string[];
      fullWidth?: boolean;
    }
  | {
      kind: "file";
      name: string;
      label: string;
      required?: boolean;
      helper?: string;
      fullWidth?: boolean;
    }
  | {
      kind: "checkbox";
      name: string;
      label: string;
      required?: boolean;
      helper?: string;
      checkboxLabel?: string;
      fullWidth?: boolean;
    };

/**
 * Declarative (serializable) description of how raw field values map onto
 * the generic /api/requests payload. Kept as data rather than a function
 * so server-component pages can pass it straight into the client FormShell.
 */
export interface SubmissionMapping {
  /** First non-empty field wins. */
  requestorNameFields: string[];
  requestorEmailFields: string[];
  investorNameField?: string;
  dealNameField?: string;
  /** Rendered as "Label: value" lines and joined into the notes column. */
  notesFields: { label: string; field: string; skipIfEmpty?: boolean }[];
  /** Semantic key (matches the integration's field map, e.g. ClickUp
   *  custom field keys) -> form field name. Sent alongside notes so an
   *  integration can populate structured fields, not just free text. */
  customFields?: { key: string; field: string }[];
}

export interface FormShellProps {
  slug: RequestTypeSlug;
  title: string;
  descriptionParagraphs: string[];
  fields: FieldConfig[];
  submissionMapping: SubmissionMapping;
  /** Optional prefill (e.g. a template picker above the form). Merges into
   *  the current values whenever it changes — existing hardcoded pages
   *  never pass this, so their behavior is unchanged. */
  initialValues?: Record<string, string>;
  /** Rendered between the intro text and the form fields (e.g. a template
   *  library) — hidden once the form has been submitted. */
  beforeForm?: React.ReactNode;
}

type SubmitState = "idle" | "uploading" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-[6px] border border-gray-200 bg-white px-[12px] py-[12px] text-sm text-black placeholder:text-gray-300 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-black/10";

export function FormShell({
  slug,
  title,
  descriptionParagraphs,
  fields,
  submissionMapping,
  initialValues,
  beforeForm,
}: FormShellProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const isSubmitting = state === "uploading" || state === "submitting";

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function setFile(name: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [name]: file }));
  }

  async function uploadFieldFiles(): Promise<AttachmentInput[]> {
    const entries = Object.entries(files).filter(([, file]) => file);
    if (entries.length === 0) return [];

    const supabase = getSupabaseBrowserClient();
    const uploaded: AttachmentInput[] = [];

    for (const [fieldName, file] of entries) {
      if (!file) continue;
      const path = `${slug}/${Date.now()}-${file.name}`;
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
        fieldKey: fieldName,
      });
    }

    return uploaded;
  }

  function resolveSubmission() {
    const firstNonEmpty = (fieldNames: string[]) =>
      fieldNames.map((name) => values[name]?.trim()).find((value) => !!value) ?? "";

    const notes = submissionMapping.notesFields
      .map(({ label, field, skipIfEmpty }) => {
        const value = values[field] ?? "";
        if (skipIfEmpty && !value.trim()) return null;
        return `${label}: ${value}`;
      })
      .filter((line): line is string => line !== null)
      .join("\n");

    const customFields: Record<string, string> = {};
    for (const { key, field } of submissionMapping.customFields ?? []) {
      const value = values[field]?.trim();
      if (value) customFields[key] = value;
    }

    return {
      requestorName: firstNonEmpty(submissionMapping.requestorNameFields),
      requestorEmail: firstNonEmpty(submissionMapping.requestorEmailFields),
      investorName: submissionMapping.investorNameField
        ? values[submissionMapping.investorNameField] ?? ""
        : "",
      dealName: submissionMapping.dealNameField ? values[submissionMapping.dealNameField] ?? "" : "",
      notes,
      customFields,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      setState("uploading");
      const attachments = await uploadFieldFiles();

      const submission = resolveSubmission();

      setState("submitting");
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: slug,
          ...submission,
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

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1000px] px-6 py-16 text-left">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-black"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M8.5 3L4.5 7L8.5 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Axis Operations Hub
        </Link>
        <div className="mb-6 h-1 w-10 bg-black" />
        <h1 className="text-[28px] font-bold text-black sm:text-[32px]">{title}</h1>
        <div className="mt-4 max-w-2xl">
          {descriptionParagraphs.map((paragraph) => (
            <p key={paragraph} className="text-[15px] text-gray-600">
              {paragraph}
            </p>
          ))}
        </div>

        {state !== "success" && beforeForm}

        {state === "success" ? (
          <div className="mt-12 rounded-[6px] border border-gray-200 px-6 py-10 text-center">
            <h2 className="text-lg font-bold text-black">Request submitted</h2>
            <p className="mt-1.5 text-sm text-gray-600">
              Your {title.toLowerCase()} has been received.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-[6px] bg-black px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-900"
            >
              Back to Axis Operations Hub
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10">
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.name} className={field.fullWidth ? "sm:col-span-2" : undefined}>
                  <FieldLabel label={field.label} required={field.required} />
                  {field.helper && <p className="mt-1 text-xs text-gray-500">{field.helper}</p>}

                  <div className="mt-2">
                  {field.kind === "text" && (
                    <input
                      type="text"
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "email" && (
                    <input
                      type="email"
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "number" && (
                    <input
                      type="number"
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "currency" && (
                    <input
                      type="text"
                      inputMode="decimal"
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "date" && (
                    <input
                      type="date"
                      required={field.required}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "textarea" && (
                    <textarea
                      required={field.required}
                      placeholder={field.placeholder}
                      rows={5}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.kind === "select" && (
                    <div className="relative">
                      <select
                        required={field.required}
                        value={values[field.name] ?? ""}
                        onChange={(e) => setValue(field.name, e.target.value)}
                        className={`${inputClass} appearance-none pr-9`}
                      >
                        <option value="" disabled hidden>
                          {field.placeholder}
                        </option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                        width="12"
                        height="8"
                        viewBox="0 0 12 8"
                        fill="none"
                      >
                        <path
                          d="M1 1.5L6 6.5L11 1.5"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}

                  {field.kind === "checkbox" && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        required={field.required}
                        checked={values[field.name] === "Yes"}
                        onChange={(e) => setValue(field.name, e.target.checked ? "Yes" : "")}
                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black/10"
                      />
                      {field.checkboxLabel ?? "Yes"}
                    </label>
                  )}

                  {field.kind === "file" && (
                    <label className="flex h-[110px] cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-gray-300 px-4 text-center text-sm text-gray-400 transition-colors hover:border-gray-400">
                      <span>
                        Drop your files here to{" "}
                        <span className="text-gray-500 underline">upload</span>
                      </span>
                      {files[field.name] && (
                        <span className="mt-1.5 max-w-full truncate text-xs text-gray-600">
                          {files[field.name]?.name}
                        </span>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setFile(field.name, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                  </div>
                </div>
              ))}
            </div>

            {state === "error" && (
              <p className="mt-6 rounded-[6px] bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="mt-10">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[6px] bg-black py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "uploading" ? "Uploading..." : state === "submitting" ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}

        <ClickUpSyncNotice />
      </div>
    </main>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-[15px] font-bold text-black">
      {label}
      {required && <span className="text-red-600">*</span>}
    </label>
  );
}
