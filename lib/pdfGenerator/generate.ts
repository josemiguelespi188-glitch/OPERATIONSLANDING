/**
 * Browser-side PDF generation for the admin PDF Generator. Runs entirely
 * client-side with pdf-lib, so nothing about a batch (logos, names,
 * generated files) ever hits our API or Vercel's request-size limits.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { zipSync } from "fflate";
import type { PdfFontName, PdfPlacement, PdfTextPlacement } from "./types";

export interface PreparedLogo {
  bytes: Uint8Array;
  kind: "png" | "jpg";
}

const FONT_MAP: Record<PdfFontName, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  "Helvetica-Bold": StandardFonts.HelveticaBold,
  "Times-Roman": StandardFonts.TimesRoman,
  "Times-Bold": StandardFonts.TimesRomanBold,
  Courier: StandardFonts.Courier,
};

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
  return Array.from(text.normalize("NFC"))
    .map((ch) => {
      if (supported.has(ch.codePointAt(0)!)) return ch;
      const stripped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return stripped && Array.from(stripped).every((c) => supported.has(c.codePointAt(0)!)) ? stripped : "?";
    })
    .join("");
}

function drawTextBox(page: ReturnType<PDFDocument["getPages"]>[number], font: PDFFont, box: PdfTextPlacement, raw: string) {
  const text = encodableText(font, raw.trim());
  if (!text) return;

  // Shrink to fit the box width (and height), never grow past the chosen size.
  let size = box.fontSize;
  while (size > 4 && (font.widthOfTextAtSize(text, size) > box.width || font.heightAtSize(size) > box.height)) {
    size -= 0.5;
  }

  const width = font.widthOfTextAtSize(text, size);
  const total = font.heightAtSize(size);
  const descent = total - font.heightAtSize(size, { descender: false });
  const x =
    box.align === "left" ? box.x : box.align === "right" ? box.x + box.width - width : box.x + (box.width - width) / 2;
  const y = box.y + (box.height - total) / 2 + descent;

  page.drawText(text, { x, y, size, font, color: hexToRgb(box.color) });
}

export async function generatePdf(
  templateBytes: ArrayBuffer | Uint8Array,
  mapping: PdfPlacement[],
  data: { name: string; logo: PreparedLogo | null }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const fonts = new Map<PdfFontName, PDFFont>();
  const image = data.logo
    ? data.logo.kind === "png"
      ? await doc.embedPng(data.logo.bytes)
      : await doc.embedJpg(data.logo.bytes)
    : null;

  for (const box of mapping) {
    const page = pages[box.page];
    if (!page) continue;

    if (box.type === "text") {
      let font = fonts.get(box.font);
      if (!font) {
        font = await doc.embedFont(FONT_MAP[box.font] ?? StandardFonts.Helvetica);
        fonts.set(box.font, font);
      }
      drawTextBox(page, font, box, data.name);
    } else if (image) {
      // Contain: keep the logo's aspect ratio, centered in the box.
      const scale = Math.min(box.width / image.width, box.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h });
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
