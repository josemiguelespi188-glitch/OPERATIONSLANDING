"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfPlacement } from "@/lib/pdfGenerator/types";
import {
  downloadBytes,
  generatePdf,
  prepareLogo,
  uniqueFileName,
  zipFiles,
  type PreparedLogo,
} from "@/lib/pdfGenerator/generate";

interface LogoItem {
  id: string;
  file: File;
  url: string;
}

interface Row {
  id: string;
  name: string;
  logoId: string | null;
}

const IMAGE_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Case/accent/punctuation-insensitive key, so "Acme Corp" matches "acme_corp.png". */
function matchKey(s: string) {
  return s
    .replace(IMAGE_EXT, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function nameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * One entry per line. A line can be just a name, or "name<TAB>logo file"
 * (pasted from Excel/Sheets) or "name, logo.png" (CSV). A comma only
 * splits off a logo when the last part looks like an image file name, so
 * names like "Acme, Inc." stay intact.
 */
function parseLines(text: string): { name: string; logo: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) {
        const [name, logo] = line.split("\t").map((p) => p.trim().replace(/^"|"$/g, ""));
        return { name, logo: logo || null };
      }
      const lastComma = line.lastIndexOf(",");
      if (lastComma > 0) {
        const tail = line.slice(lastComma + 1).trim().replace(/^"|"$/g, "");
        if (IMAGE_EXT.test(tail)) {
          return { name: line.slice(0, lastComma).trim().replace(/^"|"$/g, ""), logo: tail };
        }
      }
      return { name: line.replace(/^"|"$/g, ""), logo: null };
    })
    .filter((r) => r.name);
}

export function BulkGenerator({
  templateBytes,
  mapping,
  unsaved,
}: {
  templateBytes: Uint8Array;
  mapping: PdfPlacement[];
  unsaved: boolean;
}) {
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const preparedCache = useRef(new Map<string, PreparedLogo>());

  const logosRef = useRef(logos);
  logosRef.current = logos;
  useEffect(() => () => logosRef.current.forEach((l) => URL.revokeObjectURL(l.url)), []);

  const hasNameBox = mapping.some((m) => m.type === "text");
  const hasLogoBox = mapping.some((m) => m.type === "image");

  function addLogos(files: FileList | null) {
    if (!files?.length) return;
    const added: LogoItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name))
      .map((file) => ({ id: newId(), file, url: URL.createObjectURL(file) }));
    const allLogos = [...logos, ...added];
    setLogos(allLogos);

    setRows((current) => {
      const next = [...current];
      for (const logo of added) {
        const key = matchKey(logo.file.name);
        // Attach to an existing row that's waiting for this logo, else start a new row.
        const waiting = next.find((r) => !r.logoId && matchKey(r.name) === key);
        if (waiting) waiting.logoId = logo.id;
        else next.push({ id: newId(), name: nameFromFile(logo.file.name), logoId: logo.id });
      }
      return next;
    });
  }

  function addNames(text: string) {
    const entries = parseLines(text);
    if (!entries.length) return;
    setRows((current) => {
      const next = current.map((r) => ({ ...r }));
      for (const entry of entries) {
        const logoKey = matchKey(entry.logo ?? entry.name);
        const logo = logos.find((l) => matchKey(l.file.name) === logoKey);
        // A logo upload already created a row for this logo: just give it the proper name.
        const existing = logo ? next.find((r) => r.logoId === logo.id) : undefined;
        if (existing) existing.name = entry.name;
        else next.push({ id: newId(), name: entry.name, logoId: logo?.id ?? null });
      }
      return next;
    });
    setPasteText("");
  }

  async function readListFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    addNames(await file.text());
  }

  async function getPrepared(logoId: string | null): Promise<PreparedLogo | null> {
    if (!logoId) return null;
    const cached = preparedCache.current.get(logoId);
    if (cached) return cached;
    const logo = logos.find((l) => l.id === logoId);
    if (!logo) return null;
    const prepared = await prepareLogo(logo.file);
    preparedCache.current.set(logoId, prepared);
    return prepared;
  }

  async function buildOne(row: Row) {
    return generatePdf(templateBytes, mapping, { name: row.name, logo: await getPrepared(row.logoId) });
  }

  async function downloadOne(row: Row) {
    setError("");
    try {
      downloadBytes(await buildOne(row), uniqueFileName(row.name, new Set()), "application/pdf");
    } catch (err) {
      setError(`${row.name}: ${err instanceof Error ? err.message : "could not generate."}`);
    }
  }

  async function generateAll() {
    const ready = rows.filter((r) => r.name.trim());
    if (!ready.length) return;
    setError("");
    setProgress({ done: 0, total: ready.length });
    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    const failures: string[] = [];
    for (let i = 0; i < ready.length; i++) {
      const row = ready[i];
      try {
        files[uniqueFileName(row.name, used)] = await buildOne(row);
      } catch (err) {
        failures.push(`${row.name} (${err instanceof Error ? err.message : "error"})`);
      }
      setProgress({ done: i + 1, total: ready.length });
      // Let the progress bar paint between documents.
      await new Promise((r) => setTimeout(r, 0));
    }

    const names = Object.keys(files);
    if (names.length === 1) {
      downloadBytes(files[names[0]], names[0], "application/pdf");
    } else if (names.length > 1) {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBytes(zipFiles(files), `generated-pdfs-${stamp}.zip`, "application/zip");
    }
    if (failures.length) setError(`Could not generate: ${failures.join("; ")}`);
    setProgress(null);
  }

  const missingLogo = hasLogoBox ? rows.filter((r) => !r.logoId).length : 0;
  const unusedLogos = logos.filter((l) => !rows.some((r) => r.logoId === l.id));

  return (
    <div className="space-y-6">
      {(unsaved || !hasNameBox || !hasLogoBox) && (
        <div className="space-y-2">
          {unsaved && (
            <p className="rounded-[8px] bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The mapping has unsaved changes. PDFs will use what you see in the editor, but remember to save it.
            </p>
          )}
          {(!hasNameBox || !hasLogoBox) && (
            <p className="rounded-[8px] bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This template has no {!hasNameBox && !hasLogoBox ? "name or logo" : !hasNameBox ? "name" : "logo"} box yet.
              Add one in the Mapping tab.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-card border border-axis-base/30 bg-white p-5">
          <p className="text-sm font-semibold text-axis-core">Logos</p>
          <p className="mt-1 text-xs text-axis-core/60">
            Select many at once. Each logo becomes a row named after its file (acme_corp.png becomes
            &quot;acme corp&quot;), which you can rename below. PNG, JPG, SVG, WebP.
          </p>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addLogos(e.dataTransfer.files);
            }}
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-axis-base/60 px-4 py-6 text-center text-xs text-axis-core/60 hover:border-axis-core/50 hover:bg-axis-light/50"
          >
            <span className="font-semibold text-axis-core">Choose logo files</span>
            <span className="mt-0.5">{logos.length ? `${logos.length} uploaded` : "or drop them here"}</span>
            <input
              type="file"
              accept="image/*,.svg"
              multiple
              className="sr-only"
              onChange={(e) => {
                addLogos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </section>

        <section className="rounded-card border border-axis-base/30 bg-white p-5">
          <p className="text-sm font-semibold text-axis-core">Names</p>
          <p className="mt-1 text-xs text-axis-core/60">
            One per line. To pair a name with a logo, add the logo file name after a tab or comma
            (e.g. <code>Acme Corp, acme.png</code>), or just paste two columns from Excel. Names that
            match a logo file name are paired automatically.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={"Acme Corp\nGlobex, globex-logo.png"}
            className="mt-3 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="cursor-pointer text-xs font-medium text-axis-core/70 hover:text-axis-core hover:underline">
              Upload CSV / TXT
              <input
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  readListFile(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => addNames(pasteText)}
              disabled={!pasteText.trim()}
              className="rounded-[8px] bg-axis-core px-3 py-1.5 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
            >
              Add names
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-card border border-axis-base/30 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-axis-base/20 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-axis-core">
              {rows.length} PDF{rows.length === 1 ? "" : "s"} to generate
            </p>
            <p className="mt-0.5 text-xs text-axis-core/50">
              {missingLogo > 0 && `${missingLogo} without a logo (the logo box stays empty). `}
              {unusedLogos.length > 0 && `${unusedLogos.length} logo${unusedLogos.length === 1 ? "" : "s"} not used yet.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  logos.forEach((l) => URL.revokeObjectURL(l.url));
                  setLogos([]);
                  preparedCache.current.clear();
                }}
                disabled={!!progress}
                className="rounded-[8px] px-3 py-2 text-xs font-medium text-axis-core/60 hover:bg-axis-light"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={generateAll}
              disabled={!!progress || !rows.some((r) => r.name.trim()) || mapping.length === 0}
              className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
            >
              {progress
                ? `Generating ${progress.done} / ${progress.total}...`
                : rows.length > 1
                  ? `Generate ${rows.length} PDFs (ZIP)`
                  : "Generate PDF"}
            </button>
          </div>
        </div>

        {progress && (
          <div className="h-1 bg-axis-light">
            <div
              className="h-1 bg-axis-signal transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        )}

        {error && <p className="mx-5 mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-axis-core/50">
            Upload logos or add names to start.
          </p>
        ) : (
          <ul>
            {rows.map((row, i) => {
              const logo = logos.find((l) => l.id === row.logoId);
              return (
                <li
                  key={row.id}
                  className={`flex items-center gap-3 px-5 py-2.5 ${i !== 0 ? "border-t border-axis-base/15" : ""}`}
                >
                  <span className="w-6 shrink-0 text-right text-xs text-axis-core/40">{i + 1}</span>
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-[6px] border border-axis-base/30 bg-axis-light/50">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo.url} alt="" className="max-h-9 max-w-[60px] object-contain" />
                    ) : (
                      <span className="text-[10px] text-axis-core/40">No logo</span>
                    )}
                  </div>
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="Name"
                    className="min-w-0 flex-1 rounded-[8px] border border-axis-base/40 px-3 py-1.5 text-sm outline-none focus:border-axis-core"
                  />
                  <select
                    value={row.logoId ?? ""}
                    onChange={(e) =>
                      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, logoId: e.target.value || null } : r)))
                    }
                    className="w-44 shrink-0 truncate rounded-[8px] border border-axis-base/40 bg-white px-2 py-1.5 text-xs outline-none focus:border-axis-core"
                  >
                    <option value="">No logo</option>
                    {logos.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.file.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => downloadOne(row)}
                    disabled={!row.name.trim() || !!progress}
                    className="shrink-0 rounded-[8px] border border-axis-base/50 px-2.5 py-1.5 text-xs font-medium text-axis-core hover:bg-axis-light disabled:opacity-40"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                    className="shrink-0 rounded-[6px] px-1.5 py-1 text-sm text-axis-core/40 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
