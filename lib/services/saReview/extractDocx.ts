import JSZip from "jszip";

/**
 * Pulls structured "evidence" out of a .docx's word/document.xml for the
 * SA mapping-readiness review (see checklist.ts). This is the Vercel-only
 * MVP approximation: the real sa-mapping-review Claude Code skill
 * converts the document to PDF/images and visually reads the render to
 * judge blank-field width and alignment (categories 1-2); that pipeline
 * needs LibreOffice, which isn't available in a serverless function. This
 * module instead extracts the underlying XML geometry (table cell widths
 * in dxa, runs of underscores used as blank fill-in lines) and hands that
 * -- plus the plain text and several regex-based scans -- to Claude
 * (analyzeWithClaude.ts) to make the actual judgment calls, the same way
 * the skill does for the non-visual categories (3-7).
 *
 * Deliberately regex/string based rather than a full XML DOM parse: Word
 * splits a single visible phrase across many <w:r> runs (spell-check
 * markers, revision ids), so per-paragraph text has to be reassembled by
 * concatenating every <w:t> inside each <w:p>, not read token by token.
 */

export interface DocxEvidence {
  plainText: string;
  blanks: { context: string; underscoreLength: number }[];
  tableCells: { context: string; widthDxa: number | null }[];
  highlightedOrShaded: { context: string }[];
  tbdMatches: { context: string }[];
  literalDates: { context: string; match: string }[];
  classMentions: { context: string; match: string }[];
  possiblyPrefilledFields: { label: string; value: string; context: string }[];
}

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

function extractParagraphText(paragraphXml: string): string {
  const matches = paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g);
  let text = "";
  for (const m of matches) text += decodeXmlEntities(m[1]);
  return text;
}

function paragraphIsHighlighted(paragraphXml: string): boolean {
  if (/<w:highlight\s+w:val="(?!none)[^"]+"/.test(paragraphXml)) return true;
  const shdMatch = paragraphXml.match(/<w:shd\s[^>]*w:fill="([0-9A-Fa-f]{6}|auto)"/);
  if (shdMatch && shdMatch[1].toLowerCase() !== "auto" && shdMatch[1].toLowerCase() !== "ffffff") return true;
  return false;
}

function context(text: string, index: number, matchLength: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchLength + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export async function extractDocxEvidence(buffer: Buffer): Promise<DocxEvidence> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("This file doesn't look like a valid .docx (missing word/document.xml).");
  }
  const xml = await documentXmlFile.async("string");

  const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
  const paragraphTexts: string[] = [];
  const highlightedOrShaded: { context: string }[] = [];

  for (const p of paragraphs) {
    const text = extractParagraphText(p);
    if (text.trim()) paragraphTexts.push(text);
    if (paragraphIsHighlighted(p) && text.trim()) {
      highlightedOrShaded.push({ context: text.trim().slice(0, 160) });
    }
  }

  const plainText = paragraphTexts.join("\n");

  // Table cells: width (dxa) + the cell's own text as context.
  const tableCells: { context: string; widthDxa: number | null }[] = [];
  const cellMatches = xml.matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g);
  for (const cellMatch of cellMatches) {
    const cellXml = cellMatch[1];
    const widthMatch = cellXml.match(/<w:tcW\s+w:w="(\d+)"\s+w:type="dxa"/);
    const widthDxa = widthMatch ? Number.parseInt(widthMatch[1], 10) : null;
    const cellParagraphs = cellXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
    const cellText = cellParagraphs.map(extractParagraphText).join(" ").trim();
    if (cellText) {
      tableCells.push({ context: cellText.slice(0, 160), widthDxa });
    }
  }

  // Blank fill-in lines (runs of underscores), each with surrounding label text.
  const blanks: { context: string; underscoreLength: number }[] = [];
  for (const match of plainText.matchAll(/_{3,}/g)) {
    blanks.push({
      context: context(plainText, match.index ?? 0, match[0].length),
      underscoreLength: match[0].length,
    });
  }

  // TBD / placeholder text.
  const tbdMatches: { context: string }[] = [];
  for (const match of plainText.matchAll(/\bTBD\b|\bTo Be Determined\b|\[[^\]\n]{1,40}\]/g)) {
    tbdMatches.push({ context: context(plainText, match.index ?? 0, match[0].length) });
  }

  // Literal dates (month-name dates, numeric dates, and standalone years) --
  // Claude decides which ones are likely investor execution dates that
  // should be dynamic vs. harmless (e.g. an offering's inception year).
  const literalDates: { context: string; match: string }[] = [];
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(19|20)\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/(19|20)\d{2}\b/g,
    /\b(19|20)\d{2}\b/g,
  ];
  for (const pattern of datePatterns) {
    for (const match of plainText.matchAll(pattern)) {
      literalDates.push({
        match: match[0],
        context: context(plainText, match.index ?? 0, match[0].length),
      });
    }
  }

  // Multiple security/unit class mentions.
  const classMentions: { context: string; match: string }[] = [];
  for (const match of plainText.matchAll(/\bSecurity Class\b|\bClass\s+[A-Z0-9]\b/g)) {
    classMentions.push({
      match: match[0],
      context: context(plainText, match.index ?? 0, match[0].length),
    });
  }

  // Investment fields that may already have a value instead of being left
  // blank for mapping (e.g. "Shares Subscribed: 1,000" instead of a blank).
  const possiblyPrefilledFields: { label: string; value: string; context: string }[] = [];
  const fieldLabels = ["Shares Subscribed", "Total Purchase Price", "Price Per Share", "Security Class"];
  for (const label of fieldLabels) {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n_]{1,40})`, "gi");
    for (const match of plainText.matchAll(pattern)) {
      const value = match[1].trim();
      if (value && !/^_{2,}$/.test(value)) {
        possiblyPrefilledFields.push({
          label,
          value,
          context: context(plainText, match.index ?? 0, match[0].length),
        });
      }
    }
  }

  return {
    plainText,
    blanks,
    tableCells,
    highlightedOrShaded,
    tbdMatches,
    literalDates,
    classMentions,
    possiblyPrefilledFields,
  };
}

/**
 * A .docx has no fixed pagination (it reflows with font/margin/zoom), and
 * this app has no LibreOffice available to render real pages (see the
 * module doc comment above) -- so "page" here is a rough estimate from a
 * typical legal document's characters-per-page, not a verified page
 * number. Always label it as approximate wherever it's shown.
 */
const ESTIMATED_CHARS_PER_PAGE = 3000;

export function estimatePageFromOffset(charIndex: number): number {
  return Math.max(1, Math.floor(charIndex / ESTIMATED_CHARS_PER_PAGE) + 1);
}

/**
 * Locates a verbatim quoted snippet (as Claude is asked to provide for
 * citation) inside the document's plain text and converts its position to
 * an estimated page number. Returns null if the snippet can't be found
 * (e.g. Claude paraphrased instead of quoting) rather than guessing.
 */
export function estimatePageForSnippet(plainText: string, snippet: string | null | undefined): number | null {
  if (!snippet) return null;
  const trimmed = snippet.trim();
  if (!trimmed) return null;
  const index = plainText.indexOf(trimmed);
  if (index === -1) return null;
  return estimatePageFromOffset(index);
}
