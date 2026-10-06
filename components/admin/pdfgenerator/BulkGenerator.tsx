"use client";

import { useEffect, useRef, useState } from "react";
import { newId, resolveFileName, type PdfField, type PdfTemplateConfig } from "@/lib/pdfGenerator/types";
import {
  downloadBytes,
  generatePdf,
  prepareLogo,
  uniqueFileName,
  zipFiles,
  type PreparedLogo,
} from "@/lib/pdfGenerator/generate";
import { buildTemplateXlsx, parseXlsx } from "@/lib/pdfGenerator/xlsx";
import {
  DOC_NAME_LABEL,
  mapSheetToFields,
  parseDelimited,
  textRowsToSheet,
  type ImportedRow,
} from "@/lib/pdfGenerator/tableImport";

interface RowImage {
  blob: Blob;
  fileName: string;
  url: string;
}

interface Row {
  id: string;
  docName: string;
  text: Record<string, string>;
  images: Record<string, RowImage | null>;
  /** Image field id -> file name from an imported sheet, waiting for a matching upload. */
  refs: Record<string, string>;
}

const IMAGE_EXT = /\.(png|jpe?g|svg|webp|gif|bmp)$/i;
const EMPTY_ROWS = 3;

function emptyRow(): Row {
  return { id: newId(), docName: "", text: {}, images: {}, refs: {} };
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

function makeImage(blob: Blob, fileName: string): RowImage {
  return { blob, fileName, url: URL.createObjectURL(blob) };
}

function rowIsBlank(row: Row) {
  return (
    !row.docName.trim() &&
    !Object.values(row.text).some((v) => v.trim()) &&
    !Object.values(row.images).some(Boolean) &&
    !Object.values(row.refs).some(Boolean)
  );
}

function revokeRow(row: Row) {
  for (const img of Object.values(row.images)) if (img) URL.revokeObjectURL(img.url);
}

export function BulkGenerator({
  templateBytes,
  config,
  unsaved,
}: {
  templateBytes: Uint8Array;
  config: PdfTemplateConfig;
  unsaved: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: EMPTY_ROWS }, emptyRow));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dragCell, setDragCell] = useState<string | null>(null);
  const preparedCache = useRef(new WeakMap<Blob, PreparedLogo>());

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => () => rowsRef.current.forEach(revokeRow), []);

  const fields = config.fields;
  const textFields = fields.filter((f) => f.type === "text");
  const imageFields = fields.filter((f) => f.type === "image");
  const placed = new Set(config.boxes.map((b) => b.fieldId));
  const unplaced = fields.filter((f) => !placed.has(f.id));

  const textOf = (row: Row, f: PdfField) => (row.text[f.id]?.trim() ? row.text[f.id] : f.defaultValue);
  const hasContent = (row: Row) =>
    textFields.some((f) => row.text[f.id]?.trim()) || imageFields.some((f) => row.images[f.id]) || !!row.docName.trim();
  const fileNameFor = (row: Row, i: number) => resolveFileName(config, row.docName, (f) => textOf(row, f), `Document ${i + 1}`);

  // ---- row edits --------------------------------------------------------

  function patchRow(id: string, fn: (row: Row) => Row) {
    setRows((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  }

  function setText(id: string, fieldId: string, value: string) {
    patchRow(id, (r) => ({ ...r, text: { ...r.text, [fieldId]: value } }));
  }

  function setImage(id: string, field: PdfField, file: File | undefined | null) {
    if (file && !file.type.startsWith("image/") && !IMAGE_EXT.test(file.name)) {
      setError(`${file.name} is not an image.`);
      return;
    }
    setError("");
    patchRow(id, (r) => {
      const old = r.images[field.id];
      if (old) URL.revokeObjectURL(old.url);
      const refs = { ...r.refs };
      delete refs[field.id];
      const next: Row = { ...r, refs, images: { ...r.images, [field.id]: file ? makeImage(file, file.name) : null } };
      // Name an empty row after the image file, as a starting point.
      const first = textFields[0];
      if (file && first && !Object.values(r.text).some((v) => v.trim())) next.text = { ...r.text, [first.id]: nameFromFile(file.name) };
      return next;
    });
  }

  function removeRow(id: string) {
    setRows((rs) => {
      const row = rs.find((r) => r.id === id);
      if (row) revokeRow(row);
      const next = rs.filter((r) => r.id !== id);
      return next.length ? next : [emptyRow()];
    });
  }

  function clearAll() {
    rows.forEach(revokeRow);
    setRows(Array.from({ length: EMPTY_ROWS }, emptyRow));
    setNotice("");
    setError("");
  }

  // ---- importing --------------------------------------------------------

  function toRow(r: ImportedRow): Row {
    const images: Row["images"] = {};
    for (const [fieldId, blob] of Object.entries(r.images)) {
      if (blob) images[fieldId] = makeImage(blob, `${r.refs[fieldId] || "image"}`);
    }
    return { id: newId(), docName: r.docName, text: r.text, images, refs: r.refs };
  }

  /** Appends rows, replacing the blank placeholder rows if that's all the table has. */
  function appendRows(incoming: Row[]) {
    setRows((rs) => [...rs.filter((r) => !rowIsBlank(r)), ...incoming]);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      if (!fields.length) throw new Error("Add fields in the Mapping tab first, so the columns can be matched.");
      if (/\.xls$/i.test(file.name)) {
        throw new Error("Old .xls files aren't supported. In Excel, use File > Save As > Excel Workbook (.xlsx).");
      }
      const sheet = /\.xlsx$/i.test(file.name)
        ? await parseXlsx(file)
        : { rows: textRowsToSheet(parseDelimited(await file.text())), warnings: [] };
      const { rows: imported, matched, ignored } = mapSheetToFields(sheet.rows, fields);
      if (!imported.length) throw new Error("No rows found in that file.");
      appendRows(imported.map(toRow));

      const withImages = imported.filter((r) => Object.values(r.images).some(Boolean)).length;
      const waiting = imported.filter((r) => Object.values(r.refs).some(Boolean) && !Object.values(r.images).some(Boolean)).length;
      setNotice(
        [
          `Imported ${imported.length} row${imported.length === 1 ? "" : "s"} (columns: ${matched.join(", ")})` +
            (withImages ? `, ${withImages} with pictures from the sheet` : "") +
            ".",
          ignored.length ? `Ignored columns that don't match a field: ${ignored.join(", ")}.` : "",
          waiting ? `${waiting} row${waiting === 1 ? " names an image file" : "s name image files"}: upload them with the button in the image column header.` : "",
          ...sheet.warnings,
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
   * Pasting a block copied from Excel into any text cell spreads it across
   * rows and columns from that cell, like pasting into a spreadsheet.
   * Column order is: Document name, then each field.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ""))) return;
    e.preventDefault();
    const grid = parseDelimited(text.replace(/\r?\n$/, ""), "\t");
    const columns: ("doc" | PdfField)[] = ["doc", ...fields];
    setRows((current) => {
      const next = current.map((r) => ({ ...r, text: { ...r.text }, refs: { ...r.refs } }));
      grid.forEach((cells, dr) => {
        const at = rowIndex + dr;
        while (next.length <= at) next.push(emptyRow());
        const row = next[at];
        cells.forEach((value, dc) => {
          const target = columns[colIndex + dc];
          if (!target) return;
          const v = value.trim();
          if (target === "doc") row.docName = v;
          else if (target.type === "text") row.text[target.id] = v;
          else if (v && !row.images[target.id]) row.refs[target.id] = v;
        });
      });
      return next;
    });
  }

  /**
   * Many images at once into one image column: each file goes to the row
   * whose cell names it, else the row whose text matches the file name,
   * else the next row missing that image, else a new row.
   */
  function uploadImages(field: PdfField, fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name));
    if (!files.length) return;
    setRows((current) => {
      const next = current.map((r) => ({ ...r, text: { ...r.text }, images: { ...r.images }, refs: { ...r.refs } }));
      for (const file of files) {
        const key = matchKey(file.name);
        const free = (r: Row) => !r.images[field.id];
        const target =
          next.find((r) => free(r) && r.refs[field.id] && matchKey(r.refs[field.id]) === key) ??
          next.find(
            (r) => free(r) && [r.docName, ...textFields.map((f) => r.text[f.id] ?? "")].some((v) => v.trim() && matchKey(v) === key)
          ) ??
          next.find((r) => free(r) && !r.refs[field.id] && !rowIsBlank(r)) ??
          next.find((r) => free(r) && rowIsBlank(r));
        const image = makeImage(file, file.name);
        if (target) {
          target.images[field.id] = image;
          delete target.refs[field.id];
          const first = textFields[0];
          if (first && !Object.values(target.text).some((v) => v.trim())) target.text[first.id] = nameFromFile(file.name);
        } else {
          const row = emptyRow();
          row.images[field.id] = image;
          if (textFields[0]) row.text[textFields[0].id] = nameFromFile(file.name);
          next.push(row);
        }
      }
      return next;
    });
  }

  // ---- generating -------------------------------------------------------

  async function prepared(image: RowImage | null | undefined): Promise<PreparedLogo | null> {
    if (!image) return null;
    const cached = preparedCache.current.get(image.blob);
    if (cached) return cached;
    const p = await prepareLogo(image.blob);
    preparedCache.current.set(image.blob, p);
    return p;
  }

  async function buildOne(row: Row) {
    const images: Record<string, PreparedLogo | null> = {};
    for (const f of imageFields) images[f.id] = await prepared(row.images[f.id]);
    return generatePdf(templateBytes, config, { text: row.text, images });
  }

  async function downloadOne(row: Row, i: number) {
    setError("");
    try {
      downloadBytes(await buildOne(row), uniqueFileName(fileNameFor(row, i), new Set()), "application/pdf");
    } catch (err) {
      setError(`${fileNameFor(row, i)}: ${err instanceof Error ? err.message : "could not generate."}`);
    }
  }

  const ready = rows.map((r, i) => ({ row: r, i })).filter(({ row }) => hasContent(row));

  async function generateAll() {
    if (!ready.length) return;
    setError("");
    setProgress({ done: 0, total: ready.length });
    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    const failures: string[] = [];
    for (let n = 0; n < ready.length; n++) {
      const { row, i } = ready[n];
      try {
        files[uniqueFileName(fileNameFor(row, i), used)] = await buildOne(row);
      } catch (err) {
        failures.push(`${fileNameFor(row, i)} (${err instanceof Error ? err.message : "error"})`);
      }
      setProgress({ done: n + 1, total: ready.length });
      // Let the progress bar paint between documents.
      await new Promise((r) => setTimeout(r, 0));
    }

    const names = Object.keys(files);
    if (names.length === 1) downloadBytes(files[names[0]], names[0], "application/pdf");
    else if (names.length > 1) {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBytes(zipFiles(files), `generated-pdfs-${stamp}.zip`, "application/zip");
    }
    if (failures.length) setError(`Could not generate: ${failures.join("; ")}`);
    setProgress(null);
  }

  function downloadTemplate() {
    const headers = [
      { label: DOC_NAME_LABEL, width: 30 },
      ...fields.map((f) => ({ label: f.label, width: f.type === "image" ? 22 : 34 })),
    ];
    downloadBytes(
      buildTemplateXlsx(headers),
      "pdf-generator-template.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  const busy = !!progress || importing;
  const missingImages = imageFields.length ? ready.filter(({ row }) => imageFields.some((f) => !row.images[f.id])).length : 0;

  return (
    <div className="space-y-5">
      {(unsaved || !fields.length || unplaced.length > 0) && (
        <div className="space-y-2">
          {unsaved && (
            <Warning>The mapping has unsaved changes. PDFs will use what you see in the editor, but remember to save it.</Warning>
          )}
          {!fields.length && <Warning>This template has no fields yet. Add them in the Mapping tab.</Warning>}
          {unplaced.length > 0 && (
            <Warning>
              {unplaced.map((f) => f.label).join(", ")} {unplaced.length === 1 ? "isn't" : "aren't"} placed on the PDF yet, so{" "}
              {unplaced.length === 1 ? "it" : "they"} won&apos;t show up.
            </Warning>
          )}
        </div>
      )}

      <section className="rounded-card border border-axis-base/30 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-lg">
            <p className="text-sm font-semibold text-axis-core">Import from Excel</p>
            <p className="mt-1 text-xs leading-relaxed text-axis-core/60">
              Download the template: it has one column per field ({fields.map((f) => f.label).join(", ") || "none yet"}) plus{" "}
              {DOC_NAME_LABEL}. Fill one row per PDF. For image columns, paste the picture right into the cell (Insert &gt;
              Pictures, in or over the cell), or write its file name and upload the files afterwards. You can also paste a
              block copied from Excel straight into any cell of the table below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={!fields.length}
              className="rounded-[8px] px-3 py-2 text-xs font-medium text-axis-core/70 hover:bg-axis-light hover:text-axis-core disabled:opacity-40"
            >
              Download Excel template
            </button>
            <FileButton
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              disabled={busy || !fields.length}
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
              {ready.length} document{ready.length === 1 ? "" : "s"} to generate
            </p>
            <p className="mt-0.5 text-xs text-axis-core/50">
              {missingImages > 0
                ? `${missingImages} missing an image (that spot stays empty).`
                : "Each filled row becomes one PDF."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              disabled={busy || !ready.length || !config.boxes.length}
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
            <div className="h-1 bg-axis-signal transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}

        {error && <p className="mx-5 mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-axis-core/50">
                <th className="sticky left-0 z-10 w-12 whitespace-nowrap bg-white px-4 py-2.5 text-right font-semibold">Doc #</th>
                <th className="min-w-[200px] px-2 py-2.5 font-semibold">{DOC_NAME_LABEL}</th>
                {fields.map((f) => (
                  <th key={f.id} className={`px-2 py-2.5 font-semibold ${f.type === "image" ? "w-40 min-w-[160px]" : "min-w-[200px]"}`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{f.label}</span>
                      {f.type === "image" && (
                        <FileButton
                          accept="image/*,.svg"
                          multiple
                          disabled={busy}
                          onFiles={(files) => uploadImages(f, files)}
                          className="shrink-0 rounded-[6px] border border-axis-base/50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-axis-core hover:bg-axis-light"
                        >
                          Upload many
                        </FileButton>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="align-middle">
                  <td className="sticky left-0 z-10 border-t border-axis-base/15 bg-white px-4 py-2 text-right text-xs text-axis-core/40">
                    {i + 1}
                  </td>
                  <td className="border-t border-axis-base/15 px-2 py-2">
                    <input
                      value={row.docName}
                      onChange={(e) => patchRow(row.id, (r) => ({ ...r, docName: e.target.value }))}
                      onPaste={(e) => handlePaste(e, i, 0)}
                      placeholder={hasContent(row) ? fileNameFor(row, i) : "Auto"}
                      className={cellInputCls}
                    />
                  </td>
                  {fields.map((f, c) => (
                    <td key={f.id} className="border-t border-axis-base/15 px-2 py-2">
                      {f.type === "text" ? (
                        <input
                          value={row.text[f.id] ?? ""}
                          onChange={(e) => setText(row.id, f.id, e.target.value)}
                          onPaste={(e) => handlePaste(e, i, c + 1)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && i === rows.length - 1) {
                              e.preventDefault();
                              setRows((rs) => [...rs, emptyRow()]);
                            }
                          }}
                          placeholder={f.defaultValue || f.label}
                          className={cellInputCls}
                        />
                      ) : (
                        <ImageCell
                          image={row.images[f.id] ?? null}
                          waitingFor={row.refs[f.id]}
                          dragging={dragCell === `${row.id}:${f.id}`}
                          onDragState={(on) => setDragCell(on ? `${row.id}:${f.id}` : null)}
                          onFile={(file) => setImage(row.id, f, file)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="border-t border-axis-base/15 px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => downloadOne(row, i)}
                        disabled={!hasContent(row) || busy || !config.boxes.length}
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
        </div>
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

const cellInputCls =
  "w-full rounded-[8px] border border-axis-base/40 px-3 py-2 text-sm outline-none placeholder:text-axis-core/30 focus:border-axis-core";

function Warning({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[8px] bg-amber-50 px-3 py-2 text-xs text-amber-800">{children}</p>;
}

function ImageCell({
  image,
  waitingFor,
  dragging,
  onDragState,
  onFile,
}: {
  image: RowImage | null;
  waitingFor?: string;
  dragging: boolean;
  onDragState: (on: boolean) => void;
  onFile: (file: File | null) => void;
}) {
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        onDragState(true);
      }}
      onDragLeave={() => onDragState(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragState(false);
        onFile(e.dataTransfer.files[0] ?? null);
      }}
      title={image ? `${image.fileName} (click to replace)` : "Click or drop an image"}
      className={`group relative flex h-14 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] border ${
        dragging
          ? "border-axis-core bg-axis-signal/20"
          : image
            ? "border-axis-base/30 bg-white"
            : "border-dashed border-axis-base/60 bg-axis-light/40 hover:border-axis-core/40"
      }`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" className="max-h-12 max-w-[128px] object-contain" />
      ) : (
        <span className="px-2 text-center text-[11px] leading-tight text-axis-core/50">
          {waitingFor ? (
            <>
              Waiting for
              <br />
              <span className="font-medium text-amber-700">{waitingFor}</span>
            </>
          ) : (
            "+ Add image"
          )}
        </span>
      )}
      <input
        type="file"
        accept="image/*,.svg"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {image && (
        <button
          type="button"
          aria-label="Remove image"
          onClick={(e) => {
            e.preventDefault();
            onFile(null);
          }}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-axis-core/80 text-xs leading-none text-white group-hover:flex"
        >
          ×
        </button>
      )}
    </label>
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
