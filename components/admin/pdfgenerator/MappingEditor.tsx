"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PageViewport, RenderTask } from "pdfjs-dist";
import {
  PDF_FONTS,
  type PdfFontName,
  type PdfPlacement,
  type PdfTextAlign,
  type PdfTextPlacement,
} from "@/lib/pdfGenerator/types";
import { generatePdf, prepareLogo } from "@/lib/pdfGenerator/generate";

const CSS_FONT: Record<PdfFontName, { family: string; weight: number }> = {
  Helvetica: { family: "Helvetica, Arial, sans-serif", weight: 400 },
  "Helvetica-Bold": { family: "Helvetica, Arial, sans-serif", weight: 700 },
  "Times-Roman": { family: "'Times New Roman', Times, serif", weight: 400 },
  "Times-Bold": { family: "'Times New Roman', Times, serif", weight: 700 },
  Courier: { family: "'Courier New', Courier, monospace", weight: 400 },
};

interface PxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  start: PxRect;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function MappingEditor({
  pdfDoc,
  templateBytes,
  mapping,
  onChange,
}: {
  pdfDoc: PDFDocumentProxy;
  templateBytes: Uint8Array;
  mapping: PdfPlacement[];
  onChange: (next: PdfPlacement[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [sampleName, setSampleName] = useState("Sample Company Name");
  const [sampleLogo, setSampleLogo] = useState<File | null>(null);
  const [sampleLogoUrl, setSampleLogoUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Latest mapping for the window-level drag listeners, without re-binding them on every move.
  const mappingRef = useRef(mapping);
  mappingRef.current = mapping;

  const selected = mapping.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sampleLogo) {
      setSampleLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(sampleLogo);
    setSampleLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sampleLogo]);

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

  const toPx = useMemo(
    () =>
      (box: PdfPlacement): PxRect | null => {
        if (!viewport) return null;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
          box.x,
          box.y,
          box.x + box.width,
          box.y + box.height,
        ]);
        return {
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        };
      },
    [viewport]
  );

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

  function update(id: string, patch: Partial<PdfPlacement>) {
    onChange(mappingRef.current.map((m) => (m.id === id ? ({ ...m, ...patch } as PdfPlacement) : m)));
  }

  // Drag to move / resize.
  useEffect(() => {
    if (!drag || !viewport) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const minSize = 8;
      let rect: PxRect;
      if (drag.mode === "move") {
        rect = {
          ...drag.start,
          left: clamp(drag.start.left + dx, 0, viewport.width - drag.start.width),
          top: clamp(drag.start.top + dy, 0, viewport.height - drag.start.height),
        };
      } else {
        rect = {
          ...drag.start,
          width: clamp(drag.start.width + dx, minSize, viewport.width - drag.start.left),
          height: clamp(drag.start.height + dy, minSize, viewport.height - drag.start.top),
        };
      }
      const pdfRect = fromPx(rect);
      if (pdfRect) update(drag.id, pdfRect);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, viewport]);

  // Arrow keys nudge the selected box (Shift = 10pt), Delete/Backspace removes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!selectedId || target?.closest("input, textarea, select")) return;
      const box = mappingRef.current.find((m) => m.id === selectedId);
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
        update(box.id, { x: box.x + moves[e.key][0], y: box.y + moves[e.key][1] });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(box.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function addBox(type: "text" | "image") {
    if (!viewport) return;
    const [, , pageW, pageH] = viewport.viewBox;
    const [x0, y0] = viewport.viewBox;
    const w = type === "text" ? Math.round((pageW - x0) * 0.6) : 150;
    const h = type === "text" ? 40 : 80;
    const base = {
      id: newId(),
      page: pageIndex,
      x: round(x0 + (pageW - x0 - w) / 2),
      y: round(y0 + (pageH - y0 - h) / 2),
      width: w,
      height: h,
    };
    const box: PdfPlacement =
      type === "text"
        ? { ...base, type: "text", fontSize: 24, font: "Helvetica-Bold", color: "#000000", align: "center" }
        : { ...base, type: "image" };
    onChange([...mapping, box]);
    setSelectedId(box.id);
  }

  function remove(id: string) {
    onChange(mappingRef.current.filter((m) => m.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function duplicateToAllPages(box: PdfPlacement) {
    const copies = Array.from({ length: pdfDoc.numPages }, (_, p) => p)
      .filter((p) => p !== box.page && !mapping.some((m) => m.type === box.type && m.page === p && m.x === box.x && m.y === box.y))
      .map((p) => ({ ...box, id: newId(), page: p }));
    onChange([...mapping, ...copies]);
  }

  async function previewPdf() {
    setPreviewing(true);
    setPreviewError("");
    try {
      const logo = sampleLogo ? await prepareLogo(sampleLogo) : null;
      const bytes = await generatePdf(templateBytes, mapping, { name: sampleName, logo });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not generate the preview.");
    } finally {
      setPreviewing(false);
    }
  }

  const pageBoxes = mapping.filter((m) => m.page === pageIndex);
  const scale = viewport?.scale ?? 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addBox("text")}
              className="rounded-[8px] bg-axis-core px-3 py-1.5 text-xs font-semibold text-white hover:bg-axis-core/90"
            >
              + Name box
            </button>
            <button
              type="button"
              onClick={() => addBox("image")}
              className="rounded-[8px] bg-axis-signal px-3 py-1.5 text-xs font-semibold text-axis-core hover:bg-axis-signal/80"
            >
              + Logo box
            </button>
          </div>
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
          <div
            className="relative inline-block select-none overflow-hidden rounded-[6px] border border-axis-base/40 bg-white shadow-card"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || e.target === canvasRef.current) setSelectedId(null);
            }}
          >
            <canvas ref={canvasRef} className="block" />
            {pageBoxes.map((box) => {
              const rect = toPx(box);
              if (!rect) return null;
              const isSelected = box.id === selectedId;
              const isText = box.type === "text";
              return (
                <div
                  key={box.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedId(box.id);
                    setDrag({ id: box.id, mode: "move", startX: e.clientX, startY: e.clientY, start: rect });
                  }}
                  className={`absolute flex cursor-move items-center overflow-hidden border-2 ${
                    isText ? "border-sky-500 bg-sky-400/10" : "border-amber-500 bg-amber-400/10"
                  } ${isSelected ? "ring-2 ring-axis-core/40" : "border-dashed"}`}
                  style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                >
                  {isText ? (
                    <span
                      className="block w-full truncate leading-none"
                      style={{
                        fontFamily: CSS_FONT[(box as PdfTextPlacement).font].family,
                        fontWeight: CSS_FONT[(box as PdfTextPlacement).font].weight,
                        fontSize: (box as PdfTextPlacement).fontSize * scale,
                        color: (box as PdfTextPlacement).color,
                        textAlign: (box as PdfTextPlacement).align,
                      }}
                    >
                      {sampleName || "Name"}
                    </span>
                  ) : sampleLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sampleLogoUrl} alt="" className="pointer-events-none h-full w-full object-contain" />
                  ) : (
                    <span className="w-full text-center text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      Logo
                    </span>
                  )}
                  <span
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(box.id);
                      setDrag({ id: box.id, mode: "resize", startX: e.clientX, startY: e.clientY, start: rect });
                    }}
                    className={`absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize ${
                      isText ? "bg-sky-500" : "bg-amber-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-axis-core/50">
          Drag a box to move it, drag its corner to resize. Arrow keys nudge the selected box (hold Shift for
          bigger steps), Delete removes it.
        </p>
      </div>

      <aside className="space-y-5">
        <section className="rounded-card border border-axis-base/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Test values</p>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-axis-core/70">Sample name</span>
            <input
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-1.5 text-sm outline-none focus:border-axis-core"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-axis-core/70">Sample logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSampleLogo(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-axis-core/70 file:mr-2 file:rounded-[6px] file:border-0 file:bg-axis-light file:px-2 file:py-1.5 file:text-xs file:font-medium"
            />
          </label>
          <button
            type="button"
            onClick={previewPdf}
            disabled={previewing || mapping.length === 0}
            className="mt-4 w-full rounded-[8px] border border-axis-core px-3 py-2 text-xs font-semibold text-axis-core hover:bg-axis-light disabled:opacity-40"
          >
            {previewing ? "Generating..." : "Preview real PDF"}
          </button>
          {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
        </section>

        {selected ? (
          <section className="rounded-card border border-axis-base/30 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
                {selected.type === "text" ? "Name box" : "Logo box"} · page {selected.page + 1}
              </p>
              <button
                type="button"
                onClick={() => remove(selected.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>

            {selected.type === "text" && (
              <div className="mt-3 space-y-3">
                <Field label="Font">
                  <select
                    value={selected.font}
                    onChange={(e) => update(selected.id, { font: e.target.value as PdfFontName })}
                    className={inputCls}
                  >
                    {PDF_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Max size (pt)">
                    <input
                      type="number"
                      min={4}
                      max={300}
                      value={selected.fontSize}
                      onChange={(e) => update(selected.id, { fontSize: Number(e.target.value) || 12 })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Color">
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => update(selected.id, { color: e.target.value })}
                      className="mt-1 h-[34px] w-full cursor-pointer rounded-[8px] border border-axis-base/50 bg-white px-1"
                    />
                  </Field>
                </div>
                <Field label="Alignment">
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    {(["left", "center", "right"] as PdfTextAlign[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => update(selected.id, { align: a })}
                        className={`rounded-[6px] px-2 py-1.5 text-xs font-medium capitalize ${
                          selected.align === a ? "bg-axis-core text-white" : "bg-axis-light text-axis-core"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </Field>
                <p className="text-[11px] leading-snug text-axis-core/50">
                  Long names shrink automatically to fit the box width.
                </p>
              </div>
            )}

            {selected.type === "image" && (
              <p className="mt-3 text-[11px] leading-snug text-axis-core/50">
                Each logo is scaled to fit inside this box, keeping its proportions, and centered.
              </p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["x", "y", "width", "height"] as const).map((k) => (
                <Field key={k} label={k === "x" ? "X (pt)" : k === "y" ? "Y (pt)" : k === "width" ? "Width" : "Height"}>
                  <input
                    type="number"
                    value={selected[k]}
                    onChange={(e) => update(selected.id, { [k]: Number(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>

            {pdfDoc.numPages > 1 && (
              <button
                type="button"
                onClick={() => duplicateToAllPages(selected)}
                className="mt-3 w-full rounded-[8px] bg-axis-light px-3 py-1.5 text-xs font-medium text-axis-core hover:bg-axis-base/30"
              >
                Copy this box to every page
              </button>
            )}
          </section>
        ) : (
          <section className="rounded-card border border-dashed border-axis-base/50 p-4 text-xs text-axis-core/60">
            Add a name box and a logo box, then drag them where they belong. Select a box to change its
            font, size, color or alignment.
          </section>
        )}

        <section className="rounded-card border border-axis-base/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
            All boxes ({mapping.length})
          </p>
          {mapping.length === 0 && <p className="mt-2 text-xs text-axis-core/50">None yet.</p>}
          <ul className="mt-2 space-y-1">
            {mapping.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPageIndex(m.page);
                    setSelectedId(m.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-[6px] px-2 py-1 text-left text-xs ${
                    m.id === selectedId ? "bg-axis-light font-semibold" : "hover:bg-axis-light"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${m.type === "text" ? "bg-sky-500" : "bg-amber-500"}`} />
                    {m.type === "text" ? "Name" : "Logo"}
                  </span>
                  <span className="text-axis-core/50">page {m.page + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-[8px] border border-axis-base/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-axis-core";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-axis-core/60">{label}</span>
      {children}
    </label>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function round(v: number) {
  return Math.round(v * 10) / 10;
}
