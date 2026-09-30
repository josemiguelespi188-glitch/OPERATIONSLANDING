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
import { buildTemplateXlsx, parseXlsx, type ImportedRow } from "@/lib/pdfGenerator/xlsx";

interface RowLogo {
  blob: Blob;
  fileName: string;
  url: string;
}

interface Row {
  id: string;
  name: string;
  logo: RowLogo | null;
  /** Logo file name from an imported sheet, waiting for a matching bulk-uploaded file. */
  logoRef: string | null;
}

const IMAGE_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;
const EMPTY_ROWS = 3;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyRow(): Row {
  return { id: newId(), name: "", logo: null, logoRef: null };
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

function isBlank(row: Row) {
  return !row.name.trim() && !row.logo && !row.logoRef;
}

function makeLogo(blob: Blob, fileName: string): RowLogo {
  return { blob, fileName, url: URL.createObjectURL(blob) };
}

/**
 * CSV / pasted text: one row per line, "name<TAB>logo file" (copied from
 * Excel) or "name, logo.png". A comma only splits off a logo when the last
 * part looks like an image file name, so names like "Acme, Inc." survive.
 */
function parseLines(text: string): ImportedRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const unquote = (s: string) => s.trim().replace(/^"|"$/g, "");
      if (line.includes("\t")) {
        const [name, logo] = line.split("\t").map(unquote);
        return { name, logoRef: logo || null, image: null };
      }
      const lastComma = line.lastIndexOf(",");
      if (lastComma > 0) {
        const tail = unquote(line.slice(lastComma + 1));
        if (IMAGE_EXT.test(tail)) return { name: unquote(line.slice(0, lastComma)), logoRef: tail, image: null };
      }
      return { name: unquote(line), logoRef: null, image: null };
    })
    .filter((r) => r.name && !/^(name|nombre)$/i.test(r.name));
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
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: EMPTY_ROWS }, emptyRow));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const preparedCache = useRef(new WeakMap<Blob, PreparedLogo>());

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => () => rowsRef.current.forEach((r) => r.logo && URL.revokeObjectURL(r.logo.url)), []);

  const hasNameBox = mapping.some((m) => m.type === "text");
  const hasLogoBox = mapping.some((m) => m.type === "image");

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        if ("logo" in patch && r.logo && r.logo !== patch.logo) URL.revokeObjectURL(r.logo.url);
        return { ...r, ...patch };
      })
    );
  }

  function removeRow(id: string) {
    setRows((rs) => {
      const row = rs.find((r) => r.id === id);
      if (row?.logo) URL.revokeObjectURL(row.logo.url);
      const next = rs.filter((r) => r.id !== id);
      return next.length ? next : [emptyRow()];
    });
  }

  function setRowLogo(id: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !IMAGE_EXT.test(file.name)) {
      setError(`${file.name} is not an image.`);
      return;
    }
    setError("");
    const row = rows.find((r) => r.id === id);
    patchRow(id, {
      logo: makeLogo(file, file.name),
      logoRef: null,
      ...(row && !row.name.trim() ? { name: nameFromFile(file.name) } : {}),
    });
  }

  /** Adds imported rows, replacing the table if it only holds blank rows. */
  function addImported(imported: ImportedRow[]) {
    const incoming: Row[] = imported.map((r) => ({
      id: newId(),
      name: r.name,
      logo: r.image ? makeLogo(r.image, r.logoRef || `${r.name || "logo"}.png`) : null,
      logoRef: r.image ? null : r.logoRef,
    }));
    setRows((rs) => {
      const kept = rs.filter((r) => !isBlank(r));
      return [...kept, ...incoming];
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      if (/\.xls$/i.test(file.name)) {
        throw new Error("Old .xls files aren't supported. In Excel, use File > Save As > Excel Workbook (.xlsx).");
      }
      const result = isXlsx ? await parseXlsx(file) : { rows: parseLines(await file.text()), warnings: [] };
      if (!result.rows.length) throw new Error("No rows found in that file.");
      addImported(result.rows);
      const withImage = result.rows.filter((r) => r.image).length;
      const waiting = result.rows.filter((r) => !r.image && r.logoRef).length;
      setNotice(
        [
          `Imported ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}` +
            (withImage ? `, ${withImage} with a picture from the sheet` : "") +
            ".",
          waiting
            ? `${waiting} row${waiting === 1 ? " names a logo file" : "s name logo files"}: use "Upload logos" to attach them all at once.`
            : "",
          ...result.warnings,
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setImporting(false);
    }
  }

  /**
   * Bulk logos: each file goes to the row that names it (logo file column
   * or a matching name), else fills the next row without a logo, else
   * becomes a new row named after the file.
   */
  function uploadLogos(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name));
    if (!files.length) return;
    setRows((current) => {
      const next = current.map((r) => ({ ...r }));
      for (const file of files) {
        const key = matchKey(file.name);
        const target =
          next.find((r) => !r.logo && r.logoRef && matchKey(r.logoRef) === key) ??
          next.find((r) => !r.logo && r.name.trim() && matchKey(r.name) === key) ??
          next.find((r) => !r.logo && !r.logoRef && !r.name.trim());
        const logo = makeLogo(file, file.name);
        if (target) {
          target.logo = logo;
          target.logoRef = null;
          if (!target.name.trim()) target.name = nameFromFile(file.name);
        } else {
          next.push({ id: newId(), name: nameFromFile(file.name), logo, logoRef: null });
        }
      }
      return next;
    });
  }

  async function getPrepared(logo: RowLogo | null): Promise<PreparedLogo | null> {
    if (!logo) return null;
    const cached = preparedCache.current.get(logo.blob);
    if (cached) return cached;
    const prepared = await prepareLogo(logo.blob);
    preparedCache.current.set(logo.blob, prepared);
    return prepared;
  }

  async function buildOne(row: Row) {
    return generatePdf(templateBytes, mapping, { name: row.name, logo: await getPrepared(row.logo) });
  }

  async function downloadOne(row: Row) {
    setError("");
    try {
      downloadBytes(await buildOne(row), uniqueFileName(row.name, new Set()), "application/pdf");
    } catch (err) {
      setError(`${row.name}: ${err instanceof Error ? err.message : "could not generate."}`);
    }
  }

  const ready = rows.filter((r) => r.name.trim());

  async function generateAll() {
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

  function clearAll() {
    rows.forEach((r) => r.logo && URL.revokeObjectURL(r.logo.url));
    setRows(Array.from({ length: EMPTY_ROWS }, emptyRow));
    setNotice("");
    setError("");
  }

  const missingLogo = hasLogoBox ? ready.filter((r) => !r.logo).length : 0;
  const busy = !!progress || importing;

  return (
    <div className="space-y-5">
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

      <section className="rounded-card border border-axis-base/30 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-axis-core">Import from Excel</p>
            <p className="mt-1 text-xs leading-relaxed text-axis-core/60">
              One row per PDF: a <b>Name</b> column and a <b>Logo</b> column. Paste each logo right into its
              cell in Excel (Insert &gt; Pictures, placed in or over the cell) and it comes in with the row.
              The Logo column can also hold a file name (acme.png) to match with &quot;Upload logos&quot;.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadBytes(
                  buildTemplateXlsx(),
                  "pdf-generator-template.xlsx",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
              }
              className="rounded-[8px] px-3 py-2 text-xs font-medium text-axis-core/70 hover:bg-axis-light hover:text-axis-core"
            >
              Download Excel template
            </button>
            <FileButton
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              disabled={busy}
              onFiles={(f) => importFile(f?.[0])}
              className="rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90"
            >
              {importing ? "Reading..." : "Import Excel / CSV"}
            </FileButton>
          </div>
        </div>
        {notice && <p className="mt-4 rounded-[8px] bg-axis-light px-3 py-2 text-xs text-axis-core/80">{notice}</p>}
      </section>

      <section className="rounded-card border border-axis-base/30 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-axis-base/20 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-axis-core">
              {ready.length} PDF{ready.length === 1 ? "" : "s"} to generate
            </p>
            <p className="mt-0.5 text-xs text-axis-core/50">
              {missingLogo > 0
                ? `${missingLogo} without a logo (the logo box stays empty).`
                : "Each row with a name becomes one PDF."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FileButton
              accept="image/*,.svg"
              multiple
              disabled={busy}
              onFiles={uploadLogos}
              className="rounded-[8px] border border-axis-base/50 px-3 py-2 text-xs font-semibold text-axis-core hover:bg-axis-light"
            >
              Upload logos
            </FileButton>
            <button
              type="button"
              onClick={() => setPasteOpen((o) => !o)}
              className="rounded-[8px] border border-axis-base/50 px-3 py-2 text-xs font-semibold text-axis-core hover:bg-axis-light"
            >
              Paste names
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="rounded-[8px] px-3 py-2 text-xs font-medium text-axis-core/60 hover:bg-axis-light disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={generateAll}
              disabled={busy || !ready.length || mapping.length === 0}
              className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
            >
              {progress
                ? `Generating ${progress.done} / ${progress.total}...`
                : ready.length > 1
                  ? `Generate ${ready.length} PDFs (ZIP)`
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

        {pasteOpen && (
          <div className="border-b border-axis-base/20 bg-axis-light/40 px-5 py-4">
            <p className="text-xs text-axis-core/60">
              One name per line. You can also copy two columns (Name, Logo file) straight from Excel.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder={"Acme Corp\nGlobex\tglobex.png"}
              className="mt-2 w-full rounded-[8px] border border-axis-base/50 bg-white px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="rounded-[8px] px-3 py-1.5 text-xs font-medium text-axis-core/60 hover:bg-axis-light"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={() => {
                  addImported(parseLines(pasteText));
                  setPasteText("");
                  setPasteOpen(false);
                }}
                className="rounded-[8px] bg-axis-core px-3 py-1.5 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
              >
                Add to table
              </button>
            </div>
          </div>
        )}

        {error && <p className="mx-5 mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-axis-core/50">
              <th className="w-12 px-5 py-2.5 text-right font-semibold">#</th>
              <th className="w-40 px-2 py-2.5 font-semibold">Logo</th>
              <th className="px-2 py-2.5 font-semibold">Name</th>
              <th className="w-28 px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t border-axis-base/15 align-middle">
                <td className="px-5 py-2 text-right text-xs text-axis-core/40">{i + 1}</td>
                <td className="px-2 py-2">
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragRowId(row.id);
                    }}
                    onDragLeave={() => setDragRowId((id) => (id === row.id ? null : id))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragRowId(null);
                      setRowLogo(row.id, e.dataTransfer.files[0]);
                    }}
                    title={row.logo ? `${row.logo.fileName} (click to replace)` : "Click or drop an image"}
                    className={`group relative flex h-14 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] border ${
                      dragRowId === row.id
                        ? "border-axis-core bg-axis-signal/20"
                        : row.logo
                          ? "border-axis-base/30 bg-white"
                          : "border-dashed border-axis-base/60 bg-axis-light/40 hover:border-axis-core/40"
                    }`}
                  >
                    {row.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logo.url} alt="" className="max-h-12 max-w-[128px] object-contain" />
                    ) : (
                      <span className="px-2 text-center text-[11px] leading-tight text-axis-core/50">
                        {row.logoRef ? (
                          <>
                            Waiting for
                            <br />
                            <span className="font-medium text-amber-700">{row.logoRef}</span>
                          </>
                        ) : (
                          "+ Add logo"
                        )}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*,.svg"
                      className="sr-only"
                      onChange={(e) => {
                        setRowLogo(row.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {row.logo && (
                      <button
                        type="button"
                        aria-label="Remove logo"
                        onClick={(e) => {
                          e.preventDefault();
                          patchRow(row.id, { logo: null });
                        }}
                        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-axis-core/80 text-xs leading-none text-white group-hover:flex"
                      >
                        ×
                      </button>
                    )}
                  </label>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={row.name}
                    onChange={(e) => patchRow(row.id, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && i === rows.length - 1) {
                        e.preventDefault();
                        setRows((rs) => [...rs, emptyRow()]);
                      }
                    }}
                    placeholder="Name"
                    className="w-full rounded-[8px] border border-axis-base/40 px-3 py-2 text-sm outline-none focus:border-axis-core"
                  />
                </td>
                <td className="px-5 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => downloadOne(row)}
                      disabled={!row.name.trim() || busy}
                      className="rounded-[8px] border border-axis-base/50 px-2.5 py-1.5 text-xs font-medium text-axis-core hover:bg-axis-light disabled:opacity-30"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      aria-label="Remove row"
                      onClick={() => removeRow(row.id)}
                      className="rounded-[6px] px-1.5 py-1 text-base leading-none text-axis-core/40 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-axis-base/15 px-5 py-3">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="text-xs font-semibold text-axis-core/70 hover:text-axis-core"
          >
            + Add row
          </button>
        </div>
      </section>
    </div>
  );
}

function FileButton({
  children,
  accept,
  multiple,
  disabled,
  onFiles,
  className,
}: {
  children: React.ReactNode;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
  className: string;
}) {
  return (
    <label className={`${className} ${disabled ? "pointer-events-none opacity-40" : "cursor-pointer"}`}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
