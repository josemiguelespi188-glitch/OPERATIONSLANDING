"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PageViewport, RenderTask } from "pdfjs-dist";
import {
  BOX_DEFAULTS,
  PDF_FONT_FAMILIES,
  newId,
  resolveFileName,
  type PdfBox,
  type PdfField,
  type PdfFieldType,
  type PdfFontFamily,
  type PdfHAlign,
  type PdfTemplateConfig,
  type PdfVAlign,
} from "@/lib/pdfGenerator/types";
import { generatePdf, prepareLogo, type PreparedLogo } from "@/lib/pdfGenerator/generate";

const CSS_FAMILY: Record<PdfFontFamily, string> = {
  Helvetica: "Helvetica, Arial, sans-serif",
  Times: "'Times New Roman', Times, serif",
  Courier: "'Courier New', Courier, monospace",
};

/** Distinct outline colors so each field's boxes are easy to tell apart on the page. */
const FIELD_COLORS = ["#0284c7", "#d97706", "#7c3aed", "#059669", "#db2777", "#4f46e5", "#ca8a04", "#0d9488"];

interface PxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type DragState =
  | { mode: "move" | "resize"; id: string; startX: number; startY: number; start: PxRect }
  | { mode: "create"; fieldId: string; originX: number; originY: number; rect: PxRect };

let measureCtx: CanvasRenderingContext2D | null = null;
/** Rough on-screen version of the generator's shrink-to-fit, for single-line text previews. */
function previewFontSize(text: string, box: PdfBox, scale: number): number {
  let size = box.fontSize;
  if (!box.autoShrink || box.multiline || typeof document === "undefined") return size * scale;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return size * scale;
  const t = box.uppercase ? text.toUpperCase() : text;
  while (size > 4) {
    measureCtx.font = `${box.italic ? "italic " : ""}${box.bold ? "700 " : "400 "}${size}px ${CSS_FAMILY[box.fontFamily]}`;
    if (measureCtx.measureText(t).width <= box.width && size * 1.15 <= box.height) break;
    size -= 0.5;
  }
  return size * scale;
}

export function MappingEditor({
  pdfDoc,
  templateBytes,
  config,
  onChange,
}: {
  pdfDoc: PDFDocumentProxy;
  templateBytes: Uint8Array;
  config: PdfTemplateConfig;
  onChange: (next: PdfTemplateConfig) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(config.fields[0]?.id ?? null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [sampleImages, setSampleImages] = useState<Record<string, { file: File; url: string }>>({});
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Latest config for window-level listeners, without re-binding them on every change.
  const configRef = useRef(config);
  configRef.current = config;

  const fieldById = useMemo(() => new Map(config.fields.map((f) => [f.id, f])), [config.fields]);
  const colorOf = (fieldId: string) =>
    FIELD_COLORS[Math.max(0, config.fields.findIndex((f) => f.id === fieldId)) % FIELD_COLORS.length];
  const selected = config.boxes.find((b) => b.id === selectedId) ?? null;
  const selectedField = selected ? fieldById.get(selected.fieldId) ?? null : null;

  const sampleImagesRef = useRef(sampleImages);
  sampleImagesRef.current = sampleImages;
  useEffect(() => () => Object.values(sampleImagesRef.current).forEach((s) => URL.revokeObjectURL(s.url)), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render the current page to the canvas at the container's width.
  useEffect(() => {
    if (!containerWidth) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: containerWidth / base.width });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      task = page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      setViewport(vp);
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdfDoc, pageIndex, containerWidth]);

  function toPx(box: Pick<PdfBox, "x" | "y" | "width" | "height">): PxRect | null {
    if (!viewport) return null;
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([box.x, box.y, box.x + box.width, box.y + box.height]);
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  }

  function fromPx(rect: PxRect) {
    if (!viewport) return null;
    const [ax, ay] = viewport.convertToPdfPoint(rect.left, rect.top);
    const [bx, by] = viewport.convertToPdfPoint(rect.left + rect.width, rect.top + rect.height);
    return {
      x: round(Math.min(ax, bx)),
      y: round(Math.min(ay, by)),
      width: round(Math.abs(bx - ax)),
      height: round(Math.abs(by - ay)),
    };
  }

  function pageBounds() {
    const [x0, y0, x1, y1] = viewport?.viewBox ?? [0, 0, 612, 792];
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---- config mutations -------------------------------------------------

  function setConfig(patch: Partial<PdfTemplateConfig>) {
    onChange({ ...configRef.current, ...patch });
  }

  function updateBox(id: string, patch: Partial<PdfBox>) {
    setConfig({ boxes: configRef.current.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function updateField(id: string, patch: Partial<PdfField>) {
    setConfig({ fields: configRef.current.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }

  function addField(type: PdfFieldType) {
    const count = config.fields.filter((f) => f.type === type).length;
    const base = type === "text" ? "Text" : "Image";
    const field: PdfField = {
      id: newId(),
      label: count ? `${base} ${count + 1}` : base,
      type,
      sample: type === "text" ? "Sample text" : "",
      defaultValue: "",
    };
    setConfig({ fields: [...configRef.current.fields, field] });
    setActiveFieldId(field.id);
    setSelectedId(null);
  }

  function removeField(field: PdfField) {
    const n = config.boxes.filter((b) => b.fieldId === field.id).length;
    if (!confirm(`Remove the field "${field.label}"${n ? ` and its ${n} box${n === 1 ? "" : "es"}` : ""}?`)) return;
    setConfig({
      fields: config.fields.filter((f) => f.id !== field.id),
      boxes: config.boxes.filter((b) => b.fieldId !== field.id),
    });
    if (activeFieldId === field.id) setActiveFieldId(null);
    if (selected?.fieldId === field.id) setSelectedId(null);
  }

  function moveField(field: PdfField, dir: -1 | 1) {
    const fields = [...config.fields];
    const i = fields.indexOf(field);
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    setConfig({ fields });
  }

  /** Adds a box for a field in the middle of the current page (sized to the field type). */
  function placeBox(field: PdfField, base: PdfTemplateConfig = configRef.current, rect?: ReturnType<typeof fromPx>) {
    const { x0, y0, w: pw, h: ph } = pageBounds();
    const w = field.type === "text" ? Math.round(pw * 0.5) : 150;
    const h = field.type === "text" ? 36 : 80;
    const box: PdfBox = {
      ...BOX_DEFAULTS,
      id: newId(),
      fieldId: field.id,
      page: pageIndex,
      ...(rect ?? { x: round(x0 + (pw - w) / 2), y: round(y0 + (ph - h) / 2), width: w, height: h }),
    };
    onChange({ ...base, boxes: [...base.boxes, box] });
    setSelectedId(box.id);
  }

  function removeBox(id: string) {
    setConfig({ boxes: configRef.current.boxes.filter((b) => b.id !== id) });
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function duplicateBox(box: PdfBox) {
    const copy = { ...box, id: newId(), x: box.x + 12, y: box.y - 12 };
    setConfig({ boxes: [...configRef.current.boxes, copy] });
    setSelectedId(copy.id);
  }

  function copyToAllPages(box: PdfBox) {
    const copies = Array.from({ length: pdfDoc.numPages }, (_, p) => p)
      .filter(
        (p) =>
          p !== box.page &&
          !config.boxes.some((b) => b.fieldId === box.fieldId && b.page === p && b.x === box.x && b.y === box.y)
      )
      .map((p) => ({ ...box, id: newId(), page: p }));
    setConfig({ boxes: [...config.boxes, ...copies] });
  }

  // ---- pointer interactions ---------------------------------------------

  useEffect(() => {
    if (!drag || !viewport) return;
    const surface = canvasRef.current?.getBoundingClientRect();
    const onMove = (e: PointerEvent) => {
      if (drag.mode === "create") {
        if (!surface) return;
        const px = clamp(e.clientX - surface.left, 0, viewport.width);
        const py = clamp(e.clientY - surface.top, 0, viewport.height);
        setDrag({
          ...drag,
          rect: {
            left: Math.min(px, drag.originX),
            top: Math.min(py, drag.originY),
            width: Math.abs(px - drag.originX),
            height: Math.abs(py - drag.originY),
          },
        });
        return;
      }
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const rect =
        drag.mode === "move"
          ? {
              ...drag.start,
              left: clamp(drag.start.left + dx, 0, viewport.width - drag.start.width),
              top: clamp(drag.start.top + dy, 0, viewport.height - drag.start.height),
            }
          : {
              ...drag.start,
              width: clamp(drag.start.width + dx, 8, viewport.width - drag.start.left),
              height: clamp(drag.start.height + dy, 8, viewport.height - drag.start.top),
            };
      const pdfRect = fromPx(rect);
      if (pdfRect) updateBox(drag.id, pdfRect);
    };
    const onUp = () => {
      if (drag.mode === "create") {
        const field = configRef.current.fields.find((f) => f.id === drag.fieldId);
        if (field && drag.rect.width > 6 && drag.rect.height > 6) placeBox(field, configRef.current, fromPx(drag.rect));
        else setSelectedId(null);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, viewport]);

  // Arrow keys nudge (Shift = 10pt), Delete removes, Cmd/Ctrl+D duplicates.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!selectedId || target?.closest("input, textarea, select")) return;
      const box = configRef.current.boxes.find((b) => b.id === selectedId);
      if (!box) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        updateBox(box.id, { x: box.x + moves[e.key][0], y: box.y + moves[e.key][1] });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeBox(box.id);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateBox(box);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- preview ----------------------------------------------------------

  function setSampleImage(fieldId: string, file: File | undefined) {
    setSampleImages((cur) => {
      const next = { ...cur };
      if (next[fieldId]) URL.revokeObjectURL(next[fieldId].url);
      if (file) next[fieldId] = { file, url: URL.createObjectURL(file) };
      else delete next[fieldId];
      return next;
    });
  }

  async function previewPdf() {
    setPreviewing(true);
    setPreviewError("");
    try {
      const images: Record<string, PreparedLogo | null> = {};
      for (const [fieldId, s] of Object.entries(sampleImages)) images[fieldId] = await prepareLogo(s.file);
      const text = Object.fromEntries(config.fields.map((f) => [f.id, f.sample]));
      const bytes = await generatePdf(templateBytes, config, { text, images });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not generate the preview.");
    } finally {
      setPreviewing(false);
    }
  }

  const pageBoxes = config.boxes.filter((b) => b.page === pageIndex);
  const scale = viewport?.scale ?? 1;
  const activeField = activeFieldId ? fieldById.get(activeFieldId) ?? null : null;
  const exampleFileName = resolveFileName(config, "", (f) => f.sample || f.defaultValue, "document");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ---------------- Page ---------------- */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-axis-core/60">
            {activeField ? (
              <>
                Drag on the page to draw a box for{" "}
                <span className="font-semibold" style={{ color: colorOf(activeField.id) }}>
                  {activeField.label}
                </span>
                .
              </>
            ) : (
              "Add a field on the right, then draw where it goes."
            )}
          </p>
          {pdfDoc.numPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-axis-core/70">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => p - 1)}
                className="rounded-[6px] border border-axis-base/50 px-2 py-1 disabled:opacity-30"
              >
                Prev
              </button>
              Page {pageIndex + 1} of {pdfDoc.numPages}
              <button
                type="button"
                disabled={pageIndex >= pdfDoc.numPages - 1}
                onClick={() => setPageIndex((p) => p + 1)}
                className="rounded-[6px] border border-axis-base/50 px-2 py-1 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div ref={containerRef} className="w-full">
          <div className="relative inline-block select-none overflow-hidden rounded-[6px] border border-axis-base/40 bg-white shadow-card">
            <canvas
              ref={canvasRef}
              className={`block ${activeField ? "cursor-crosshair" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const originX = e.clientX - r.left;
                const originY = e.clientY - r.top;
                if (activeField) {
                  setDrag({ mode: "create", fieldId: activeField.id, originX, originY, rect: { left: originX, top: originY, width: 0, height: 0 } });
                } else setSelectedId(null);
              }}
            />
            {pageBoxes.map((box) => {
              const rect = toPx(box);
              const field = fieldById.get(box.fieldId);
              if (!rect || !field) return null;
              const isSelected = box.id === selectedId;
              const color = colorOf(field.id);
              const sampleImage = sampleImages[field.id];
              return (
                <div
                  key={box.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedId(box.id);
                    setActiveFieldId(field.id);
                    setDrag({ mode: "move", id: box.id, startX: e.clientX, startY: e.clientY, start: rect });
                  }}
                  className="absolute flex cursor-move overflow-hidden"
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    border: `${isSelected ? 2 : 1.5}px ${isSelected ? "solid" : "dashed"} ${color}`,
                    background: `${color}14`,
                    boxShadow: isSelected ? `0 0 0 3px ${color}33` : undefined,
                    alignItems: box.vAlign === "top" ? "flex-start" : box.vAlign === "bottom" ? "flex-end" : "center",
                  }}
                >
                  {field.type === "text" ? (
                    <span
                      className="block w-full leading-[1.15]"
                      style={{
                        fontFamily: CSS_FAMILY[box.fontFamily],
                        fontWeight: box.bold ? 700 : 400,
                        fontStyle: box.italic ? "italic" : "normal",
                        fontSize: previewFontSize(field.sample || field.label, box, scale),
                        lineHeight: box.lineHeight,
                        color: box.color,
                        textAlign: box.align,
                        textTransform: box.uppercase ? "uppercase" : "none",
                        whiteSpace: box.multiline ? "pre-wrap" : "nowrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {field.sample || field.label}
                    </span>
                  ) : sampleImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sampleImage.url}
                      alt=""
                      className="pointer-events-none h-full w-full"
                      style={{
                        objectFit: box.fit === "contain" ? "contain" : "fill",
                        objectPosition: `${box.align === "center" ? "center" : box.align} ${box.vAlign === "middle" ? "center" : box.vAlign}`,
                        opacity: box.opacity,
                      }}
                    />
                  ) : (
                    <span className="w-full text-center text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                      {field.label}
                    </span>
                  )}
                  <span
                    className="pointer-events-none absolute left-0 top-0 max-w-full truncate px-1 text-[9px] font-semibold leading-[14px] text-white"
                    style={{ background: color, opacity: isSelected ? 1 : 0.8 }}
                  >
                    {field.label}
                  </span>
                  <span
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(box.id);
                      setDrag({ mode: "resize", id: box.id, startX: e.clientX, startY: e.clientY, start: rect });
                    }}
                    className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
                    style={{ background: color }}
                  />
                </div>
              );
            })}
            {drag?.mode === "create" && (
              <div
                className="pointer-events-none absolute border-2 border-dashed"
                style={{
                  ...drag.rect,
                  borderColor: colorOf(drag.fieldId),
                  background: `${colorOf(drag.fieldId)}1f`,
                }}
              />
            )}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-axis-core/50">
          Drag a box to move it, drag its corner to resize. Arrow keys nudge the selected box (Shift for bigger
          steps), Cmd/Ctrl+D duplicates it, Delete removes it.
        </p>
      </div>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="space-y-4">
        <Panel title={`Fields (${config.fields.length})`}>
          <p className="text-[11px] leading-snug text-axis-core/50">
            Each field is one column when generating. A field can be placed in several spots.
          </p>
          <ul className="mt-3 space-y-2">
            {config.fields.map((field, i) => {
              const count = config.boxes.filter((b) => b.fieldId === field.id).length;
              const active = field.id === activeFieldId;
              const color = colorOf(field.id);
              return (
                <li
                  key={field.id}
                  onClick={() => setActiveFieldId(field.id)}
                  className={`rounded-[8px] border p-2.5 transition-colors ${
                    active ? "border-axis-core/40 bg-axis-light/60" : "border-axis-base/30 hover:border-axis-base/60"
                  }`}
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                      style={{ background: color }}
                    >
                      {field.type === "text" ? "Text" : "Image"}
                    </span>
                    <input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      aria-label="Field name"
                      className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-axis-core outline-none hover:border-axis-base/50 focus:border-axis-core focus:bg-white"
                    />
                    <IconButton label="Move up" disabled={i === 0} onClick={() => moveField(field, -1)}>
                      ↑
                    </IconButton>
                    <IconButton label="Move down" disabled={i === config.fields.length - 1} onClick={() => moveField(field, 1)}>
                      ↓
                    </IconButton>
                    <IconButton label="Remove field" danger onClick={() => removeField(field)}>
                      ×
                    </IconButton>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {field.type === "text" ? (
                      <input
                        value={field.sample}
                        onChange={(e) => updateField(field.id, { sample: e.target.value })}
                        placeholder="Sample value for preview"
                        className="min-w-0 flex-1 rounded-[6px] border border-axis-base/40 bg-white px-2 py-1 text-xs outline-none focus:border-axis-core"
                      />
                    ) : (
                      <label className="min-w-0 flex-1 cursor-pointer truncate rounded-[6px] border border-dashed border-axis-base/60 bg-white px-2 py-1 text-xs text-axis-core/60 hover:border-axis-core/50">
                        {sampleImages[field.id]?.file.name ?? "Sample image for preview"}
                        <input
                          type="file"
                          accept="image/*,.svg"
                          className="sr-only"
                          onChange={(e) => {
                            setSampleImage(field.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFieldId(field.id);
                        placeBox(field);
                      }}
                      className="shrink-0 rounded-[6px] bg-axis-core px-2 py-1 text-[11px] font-semibold text-white hover:bg-axis-core/90"
                    >
                      + Place
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-axis-core/50">
                    {count === 0 ? "Not placed yet" : `Placed ${count} time${count === 1 ? "" : "s"}`}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => addField("text")}
              className="rounded-[8px] bg-axis-core px-3 py-2 text-xs font-semibold text-white hover:bg-axis-core/90"
            >
              + Text field
            </button>
            <button
              type="button"
              onClick={() => addField("image")}
              className="rounded-[8px] bg-axis-signal px-3 py-2 text-xs font-semibold text-axis-core hover:bg-axis-signal/80"
            >
              + Image field
            </button>
          </div>
        </Panel>

        {selected && selectedField && (
          <Panel
            title={`${selectedField.label} · page ${selected.page + 1}`}
            accent={colorOf(selectedField.id)}
            action={
              <button type="button" onClick={() => removeBox(selected.id)} className="text-xs font-medium text-red-600 hover:underline">
                Delete box
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              <SmallButton onClick={() => duplicateBox(selected)}>Duplicate</SmallButton>
              {pdfDoc.numPages > 1 ? (
                <SmallButton onClick={() => copyToAllPages(selected)}>Copy to all pages</SmallButton>
              ) : (
                <span />
              )}
              <SmallButton
                onClick={() => {
                  const { x0, w } = pageBounds();
                  updateBox(selected.id, { x: round(x0 + (w - selected.width) / 2) });
                }}
              >
                Center horizontally
              </SmallButton>
              <SmallButton
                onClick={() => {
                  const { y0, h } = pageBounds();
                  updateBox(selected.id, { y: round(y0 + (h - selected.height) / 2) });
                }}
              >
                Center vertically
              </SmallButton>
            </div>

            {selectedField.type === "text" ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Field label="Font">
                    <select
                      value={selected.fontFamily}
                      onChange={(e) => updateBox(selected.id, { fontFamily: e.target.value as PdfFontFamily })}
                      className={inputCls}
                    >
                      {PDF_FONT_FAMILIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Style">
                    <div className="mt-1 flex gap-1">
                      <Toggle on={selected.bold} onClick={() => updateBox(selected.id, { bold: !selected.bold })} label="Bold">
                        <b>B</b>
                      </Toggle>
                      <Toggle on={selected.italic} onClick={() => updateBox(selected.id, { italic: !selected.italic })} label="Italic">
                        <i className="font-serif">I</i>
                      </Toggle>
                      <Toggle
                        on={selected.uppercase}
                        onClick={() => updateBox(selected.id, { uppercase: !selected.uppercase })}
                        label="Uppercase"
                      >
                        <span className="text-[10px] font-bold">AA</span>
                      </Toggle>
                    </div>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={selected.autoShrink ? "Max size (pt)" : "Size (pt)"}>
                    <input
                      type="number"
                      min={4}
                      max={300}
                      step={0.5}
                      value={selected.fontSize}
                      onChange={(e) => updateBox(selected.id, { fontSize: Number(e.target.value) || 12 })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Color">
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(e) => updateBox(selected.id, { color: e.target.value })}
                        className="h-[30px] w-9 shrink-0 cursor-pointer rounded-[6px] border border-axis-base/50 bg-white px-0.5"
                      />
                      <input
                        value={selected.color}
                        onChange={(e) =>
                          /^#[0-9a-fA-F]{6}$/.test(e.target.value) && updateBox(selected.id, { color: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-[6px] border border-axis-base/50 px-1.5 py-1 font-mono text-[11px] outline-none"
                      />
                    </div>
                  </Field>
                </div>
                <AlignControls box={selected} onChange={(p) => updateBox(selected.id, p)} />
                <div className="space-y-1.5">
                  <Check
                    checked={selected.autoShrink}
                    onChange={(v) => updateBox(selected.id, { autoShrink: v })}
                    label="Shrink to fit the box"
                  />
                  <Check
                    checked={selected.multiline}
                    onChange={(v) => updateBox(selected.id, { multiline: v })}
                    label="Wrap onto several lines"
                  />
                </div>
                {selected.multiline && (
                  <Field label={`Line spacing (${selected.lineHeight.toFixed(1)})`}>
                    <input
                      type="range"
                      min={0.8}
                      max={2.5}
                      step={0.1}
                      value={selected.lineHeight}
                      onChange={(e) => updateBox(selected.id, { lineHeight: Number(e.target.value) })}
                      className="mt-1 w-full accent-axis-core"
                    />
                  </Field>
                )}
                <Field label="If empty, use">
                  <input
                    value={selectedField.defaultValue}
                    onChange={(e) => updateField(selectedField.id, { defaultValue: e.target.value })}
                    placeholder="Leave blank to print nothing"
                    className={inputCls}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Field label="Fit">
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {(["contain", "stretch"] as const).map((fit) => (
                      <Segment key={fit} on={selected.fit === fit} onClick={() => updateBox(selected.id, { fit })}>
                        {fit === "contain" ? "Keep proportions" : "Stretch to box"}
                      </Segment>
                    ))}
                  </div>
                </Field>
                {selected.fit === "contain" && <AlignControls box={selected} onChange={(p) => updateBox(selected.id, p)} />}
                <Field label={`Opacity (${Math.round(selected.opacity * 100)}%)`}>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={selected.opacity}
                    onChange={(e) => updateBox(selected.id, { opacity: Number(e.target.value) })}
                    className="mt-1 w-full accent-axis-core"
                  />
                </Field>
              </div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-axis-base/20 pt-3">
              {(["x", "y", "width", "height"] as const).map((k) => (
                <Field key={k} label={k === "x" ? "X" : k === "y" ? "Y" : k === "width" ? "W" : "H"}>
                  <input
                    type="number"
                    value={selected[k]}
                    onChange={(e) => updateBox(selected.id, { [k]: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-[6px] border border-axis-base/50 bg-white px-1.5 py-1 text-xs outline-none focus:border-axis-core"
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-axis-core/40">Position and size in points (1/72 inch), from the bottom-left.</p>
          </Panel>
        )}

        <Panel title="Document name">
          <p className="text-[11px] leading-snug text-axis-core/50">
            Default file name for each PDF. Click a field to insert it. Can be changed per row when generating.
          </p>
          <input
            value={config.fileNamePattern}
            onChange={(e) => setConfig({ fileNamePattern: e.target.value })}
            placeholder={config.fields.find((f) => f.type === "text") ? `{${config.fields.find((f) => f.type === "text")!.label}}` : "Document"}
            className={`${inputCls} mt-2`}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {config.fields
              .filter((f) => f.type === "text")
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setConfig({ fileNamePattern: `${config.fileNamePattern}{${f.label}}` })}
                  className="rounded-full bg-axis-light px-2 py-0.5 text-[11px] font-medium text-axis-core hover:bg-axis-base/40"
                >
                  + {f.label}
                </button>
              ))}
          </div>
          <p className="mt-2 truncate text-[11px] text-axis-core/60">
            Example: <span className="font-medium text-axis-core">{exampleFileName}.pdf</span>
          </p>
        </Panel>

        <button
          type="button"
          onClick={previewPdf}
          disabled={previewing || config.boxes.length === 0}
          className="w-full rounded-[8px] border border-axis-core bg-white px-3 py-2.5 text-xs font-semibold text-axis-core hover:bg-axis-light disabled:opacity-40"
        >
          {previewing ? "Generating..." : "Preview real PDF with sample values"}
        </button>
        {previewError && <p className="text-xs text-red-600">{previewError}</p>}
      </aside>
    </div>
  );
}

// ---- small UI pieces ----------------------------------------------------

const inputCls =
  "mt-1 w-full rounded-[8px] border border-axis-base/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-axis-core";

function Panel({
  title,
  accent,
  action,
  children,
}: {
  title: string;
  accent?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-card border border-axis-base/30 bg-white p-4"
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-axis-core/50">{title}</p>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-axis-core/60">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-6 w-6 shrink-0 rounded-[6px] text-xs leading-none text-axis-core/40 disabled:opacity-20 ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-axis-light hover:text-axis-core"
      }`}
    >
      {children}
    </button>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[6px] bg-axis-light px-2 py-1.5 text-[11px] font-medium text-axis-core hover:bg-axis-base/30"
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-[30px] w-8 items-center justify-center rounded-[6px] text-sm ${
        on ? "bg-axis-core text-white" : "bg-axis-light text-axis-core hover:bg-axis-base/30"
      }`}
    >
      {children}
    </button>
  );
}

function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] px-2 py-1.5 text-[11px] font-medium ${
        on ? "bg-axis-core text-white" : "bg-axis-light text-axis-core hover:bg-axis-base/30"
      }`}
    >
      {children}
    </button>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-axis-core">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-axis-core" />
      {label}
    </label>
  );
}

function AlignControls({ box, onChange }: { box: PdfBox; onChange: (patch: Partial<PdfBox>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Horizontal">
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(["left", "center", "right"] as PdfHAlign[]).map((a) => (
            <Segment key={a} on={box.align === a} onClick={() => onChange({ align: a })}>
              <AlignIcon kind={a} />
            </Segment>
          ))}
        </div>
      </Field>
      <Field label="Vertical">
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(["top", "middle", "bottom"] as PdfVAlign[]).map((a) => (
            <Segment key={a} on={box.vAlign === a} onClick={() => onChange({ vAlign: a })}>
              <AlignIcon kind={a} />
            </Segment>
          ))}
        </div>
      </Field>
    </div>
  );
}

function AlignIcon({ kind }: { kind: PdfHAlign | PdfVAlign }) {
  const horizontal = kind === "left" || kind === "center" || kind === "right";
  const lines = horizontal
    ? [12, 8, 12].map((w, i) => {
        const x = kind === "left" ? 2 : kind === "right" ? 14 - w : (16 - w) / 2;
        return <rect key={i} x={x} y={3 + i * 4} width={w} height={2} rx={1} />;
      })
    : [0].map((i) => {
        const y = kind === "top" ? 2 : kind === "bottom" ? 10 : 6;
        return <rect key={i} x={4} y={y} width={8} height={4} rx={1} />;
      });
  return (
    <svg viewBox="0 0 16 16" className="mx-auto h-3.5 w-3.5" fill="currentColor" aria-label={kind}>
      {!horizontal && <rect x={1} y={1} width={14} height={14} rx={2} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />}
      {lines}
    </svg>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function round(v: number) {
  return Math.round(v * 10) / 10;
}
