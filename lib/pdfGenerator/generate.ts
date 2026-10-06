/**
 * Browser-side PDF generation for the admin PDF Generator. Runs entirely
 * client-side with pdf-lib, so nothing about a batch (logos, names,
 * generated files) ever hits our API or Vercel's request-size limits.
 */
import { PDFDocument, PDFName, PDFRef, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { zipSync } from "fflate";
import type { PdfBox, PdfFontFamily, PdfTemplateConfig } from "./types";

export interface PreparedLogo {
  bytes: Uint8Array;
  kind: "png" | "jpg";
}

/** One generated document: text per text field id, image per image field id. */
export interface RowValues {
  text: Record<string, string>;
  images: Record<string, PreparedLogo | null>;
}

const FONT_MAP: Record<PdfFontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  // regular, bold, italic, bold italic
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

export function standardFontFor(box: Pick<PdfBox, "fontFamily" | "bold" | "italic">): StandardFonts {
  return FONT_MAP[box.fontFamily][(box.bold ? 1 : 0) + (box.italic ? 2 : 0)];
}

/**
 * pdf-lib can only embed PNG and JPEG. Anything else the browser can
 * decode (SVG, WebP, GIF, ...) is rasterized to a PNG through a canvas,
 * at a resolution high enough to stay sharp when printed.
 */
export async function prepareLogo(file: Blob): Promise<PreparedLogo> {
  const type = file.type.toLowerCase();
  if (type === "image/png") return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "png" };
  if (type === "image/jpeg" || type === "image/jpg") {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "jpg" };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This image format could not be read."));
      el.src = url;
    });
    const naturalW = img.naturalWidth || 1000;
    const naturalH = img.naturalHeight || 1000;
    const target = 2000;
    const scale = type === "image/svg+xml" ? target / Math.max(naturalW, naturalH) : Math.min(1, target / Math.max(naturalW, naturalH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalW * scale));
    canvas.height = Math.max(1, Math.round(naturalH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not convert the image to PNG.");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: "png" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard PDF fonts only cover WinAnsi (Latin-1-ish): swap anything else for a close ASCII fallback. */
function encodableText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  supported.add(10); // newline is handled by our own line splitting
  return Array.from(text.normalize("NFC"))
    .map((ch) => {
      if (supported.has(ch.codePointAt(0)!)) return ch;
      const stripped = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return stripped && Array.from(stripped).every((c) => supported.has(c.codePointAt(0)!)) ? stripped : "?";
    })
    .join("");
}

/** Greedy word wrap; words longer than the box are broken by character. */
function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

function layoutText(font: PDFFont, box: PdfBox, text: string, size: number) {
  const lines = box.multiline ? wrapLines(text, font, size, box.width) : [text.replace(/\s*\n\s*/g, " ")];
  const lineGap = size * box.lineHeight;
  const blockHeight = font.heightAtSize(size) + (lines.length - 1) * lineGap;
  const widest = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)));
  return { lines, lineGap, blockHeight, widest };
}

function drawTextBox(page: PDFPage, font: PDFFont, box: PdfBox, raw: string) {
  let text = encodableText(font, raw.trim());
  if (box.uppercase) text = text.toUpperCase();
  if (!text) return;

  // Shrink until it fits (width, and height), never grow past the chosen size.
  let size = box.fontSize;
  let layout = layoutText(font, box, text, size);
  while (box.autoShrink && size > 4 && (layout.widest > box.width || layout.blockHeight > box.height)) {
    size = Math.max(4, size - 0.5);
    layout = layoutText(font, box, text, size);
  }

  const ascentOnly = font.heightAtSize(size, { descender: false });
  // Top of the text block, per vertical alignment.
  const blockTop =
    box.vAlign === "top"
      ? box.y + box.height
      : box.vAlign === "bottom"
        ? box.y + layout.blockHeight
        : box.y + (box.height + layout.blockHeight) / 2;

  layout.lines.forEach((line, i) => {
    const width = font.widthOfTextAtSize(line, size);
    const x =
      box.align === "left" ? box.x : box.align === "right" ? box.x + box.width - width : box.x + (box.width - width) / 2;
    const baseline = blockTop - ascentOnly - i * layout.lineGap;
    page.drawText(line, { x, y: baseline, size, font, color: hexToRgb(box.color) });
  });
}

function drawImageBox(page: PDFPage, image: PDFImage, box: PdfBox) {
  let w = box.width;
  let h = box.height;
  if (box.fit === "contain") {
    const scale = Math.min(box.width / image.width, box.height / image.height);
    w = image.width * scale;
    h = image.height * scale;
  }
  const x = box.align === "left" ? box.x : box.align === "right" ? box.x + box.width - w : box.x + (box.width - w) / 2;
  const y = box.vAlign === "bottom" ? box.y : box.vAlign === "top" ? box.y + box.height - h : box.y + (box.height - h) / 2;
  page.drawImage(image, { x, y, width: w, height: h, opacity: box.opacity });
}

/** Drops /Annots entries pointing at objects pdf-lib's flatten() deleted (it leaves them dangling). */
function pruneDanglingAnnots(doc: PDFDocument) {
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const entry = annots.get(i);
      if (entry instanceof PDFRef && !doc.context.lookup(entry)) annots.remove(i);
    }
    if (annots.size() === 0) page.node.delete(PDFName.of("Annots"));
  }
}

/**
 * Loads the template with any fillable form fields flattened into the
 * page. Form widgets are drawn above page content, so an empty field
 * (typically white) sitting where a box was mapped would hide the text or
 * image we draw there. Flattening bakes each field's current look into the
 * page itself, so everything we draw afterwards lands on top.
 *
 * Tries to keep the PDF's own field appearances first; if the form is
 * unusual, retries regenerating them, and as a last resort leaves the
 * form untouched rather than failing the whole document.
 */
async function loadTemplate(templateBytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const load = () => PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const first = await load();
  let fieldCount = 0;
  try {
    fieldCount = first.getForm().getFields().length;
  } catch {
    return first;
  }
  if (!fieldCount) return first;

  for (const updateFieldAppearances of [false, true]) {
    const doc = updateFieldAppearances ? await load() : first;
    try {
      doc.getForm().flatten({ updateFieldAppearances });
      pruneDanglingAnnots(doc);
      return doc;
    } catch {
      // try the next strategy on a fresh copy
    }
  }
  return load();
}

export async function generatePdf(
  templateBytes: ArrayBuffer | Uint8Array,
  config: PdfTemplateConfig,
  values: RowValues
): Promise<Uint8Array> {
  const doc = await loadTemplate(templateBytes);
  const pages = doc.getPages();
  const fonts = new Map<StandardFonts, PDFFont>();
  const images = new Map<string, PDFImage>();
  const fieldById = new Map(config.fields.map((f) => [f.id, f]));

  for (const box of config.boxes) {
    const page = pages[box.page];
    const field = fieldById.get(box.fieldId);
    if (!page || !field) continue;

    if (field.type === "text") {
      const value = values.text[field.id]?.trim() ? values.text[field.id] : field.defaultValue;
      if (!value?.trim()) continue;
      const fontName = standardFontFor(box);
      let font = fonts.get(fontName);
      if (!font) {
        font = await doc.embedFont(fontName);
        fonts.set(fontName, font);
      }
      drawTextBox(page, font, box, value);
    } else {
      const prepared = values.images[field.id];
      if (!prepared) continue;
      let image = images.get(field.id);
      if (!image) {
        image = prepared.kind === "png" ? await doc.embedPng(prepared.bytes) : await doc.embedJpg(prepared.bytes);
        images.set(field.id, image);
      }
      drawImageBox(page, image, box);
    }
  }

  return doc.save();
}

/** Filesystem-safe file name, deduplicated against names already used in the same ZIP. */
export function uniqueFileName(base: string, used: Set<string>, ext = ".pdf"): string {
  const clean = base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "document";
  let candidate = `${clean}${ext}`;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${clean} (${i})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export function zipFiles(files: Record<string, Uint8Array>): Uint8Array {
  // PDFs are already compressed, so storing them (level 0) keeps zipping instant.
  return zipSync(files, { level: 0 });
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
