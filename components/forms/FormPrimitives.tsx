"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { FormFieldConfig } from "@/lib/requestFormConfigs";

const inputClass =
  "w-full rounded-[6px] border border-gray-200 bg-white px-3 py-3 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black";

export function FieldLabel({ config }: { config: FormFieldConfig }) {
  return (
    <label htmlFor={config.id} className="block text-[15px] font-bold text-black">
      {config.label}
      {config.required && <span className="text-red-600">*</span>}
    </label>
  );
}

export function FieldHelper({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-gray-500">{text}</p>;
}

export function FieldShell({
  config,
  children,
}: {
  config: FormFieldConfig;
  children: React.ReactNode;
}) {
  return (
    <div className={config.fullWidth ? "sm:col-span-2" : undefined}>
      <FieldLabel config={config} />
      <FieldHelper text={config.helper} />
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function TextField({
  config,
  value,
  onChange,
}: {
  config: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const type =
    config.type === "email" ? "email" : config.type === "number" || config.type === "currency" ? "number" : "text";

  return (
    <input
      id={config.id}
      name={config.id}
      type={type}
      required={config.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config.placeholder}
      className={inputClass}
    />
  );
}

export function TextareaField({
  config,
  value,
  onChange,
}: {
  config: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      id={config.id}
      name={config.id}
      required={config.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config.placeholder}
      rows={4}
      className={`${inputClass} resize-none`}
    />
  );
}

export function SelectField({
  config,
  value,
  onChange,
}: {
  config: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        id={config.id}
        name={config.id}
        required={config.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-9 ${value ? "text-black" : "text-gray-400"}`}
      >
        <option value="" disabled>
          {config.placeholder}
        </option>
        {config.options?.map((option) => (
          <option key={option} value={option} className="text-black">
            {option}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M3.5 5.25L7 8.75L10.5 5.25"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function FileDropzone({
  config,
  files,
  onChange,
}: {
  config: FormFieldConfig;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    onChange(Array.from(event.dataTransfer.files ?? []));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Array.from(event.target.files ?? []));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-[6px] border border-dashed px-4 py-6 text-center transition-colors ${
        dragOver ? "border-black bg-gray-50" : "border-gray-300"
      }`}
    >
      <input
        ref={inputRef}
        id={config.id}
        name={config.id}
        type="file"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
      <p className="text-sm text-gray-500">
        Drop your files here to{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="underline underline-offset-2 hover:text-black"
        >
          upload
        </button>
      </p>
      {files.length > 0 && (
        <ul className="mt-2 text-xs text-gray-600">
          {files.map((file) => (
            <li key={file.name}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
