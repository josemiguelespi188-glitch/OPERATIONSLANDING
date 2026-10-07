import JSZip from "jszip";
import type { MechanicalFix } from "./analyzeWithClaude";

export interface AppliedFixSummary {
  fix: MechanicalFix;
  applied: boolean;
}

const UNDERSCORE_WIDEN_COUNT = 15;
const CELL_WIDEN_DXA = 720; // ~0.5 inch

function extractParagraphText(paragraphXml: string): string {
  const matches = paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g);
  let text = "";
  for (const m of matches) text += m[1];
  return text;
}

function widenBlankInParagraph(paragraphXml: string): string | null {
  // Append underscores to the last <w:t> run that itself contains
  // underscores, which lengthens the visible blank line without touching
  // any of the surrounding legal text.
  const runMatches = [...paragraphXml.matchAll(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g)];
  for (let i = runMatches.length - 1; i >= 0; i--) {
    const [full, attrs, text] = runMatches[i];
    if (text.includes("_")) {
      const widened = `<w:t${attrs ?? ""} xml:space="preserve">${text}${"_".repeat(UNDERSCORE_WIDEN_COUNT)}</w:t>`;
      return paragraphXml.replace(full, widened);
    }
  }
  return null;
}

function leftAlignParagraph(paragraphXml: string): string {
  if (/<w:pPr>/.test(paragraphXml)) {
    if (/<w:jc\s+w:val="[^"]*"\s*\/>/.test(paragraphXml)) {
      return paragraphXml.replace(/<w:jc\s+w:val="[^"]*"\s*\/>/, `<w:jc w:val="left"/>`);
    }
    return paragraphXml.replace(/<w:pPr>/, `<w:pPr><w:jc w:val="left"/>`);
  }
  return paragraphXml.replace(/<w:p(\s[^>]*)?>/, (m) => `${m}<w:pPr><w:jc w:val="left"/></w:pPr>`);
}

function widenCellWidth(cellXml: string): string | null {
  const widthMatch = cellXml.match(/<w:tcW\s+w:w="(\d+)"\s+w:type="dxa"/);
  if (!widthMatch) return null;
  const newWidth = Number.parseInt(widthMatch[1], 10) + CELL_WIDEN_DXA;
  return cellXml.replace(/<w:tcW\s+w:w="\d+"\s+w:type="dxa"/, `<w:tcW w:w="${newWidth}" w:type="dxa"`);
}

/**
 * Applies the category 1 (space) and category 2 (alignment) fixes Claude
 * identified to a fresh copy of the original .docx, and returns the
 * resulting buffer plus a per-fix applied/skipped summary. Deliberately
 * conservative: a fix that can't be located with confidence is skipped
 * (never guessed at), and reported back so the admin knows to check it
 * manually -- see CLAUDE.md's "SA Review" section for why only these two
 * categories are ever auto-fixed.
 */
export async function applyMechanicalFixes(
  originalBuffer: Buffer,
  fixes: MechanicalFix[]
): Promise<{ buffer: Buffer; summary: AppliedFixSummary[] }> {
  if (fixes.length === 0) {
    return { buffer: originalBuffer, summary: [] };
  }

  const zip = await JSZip.loadAsync(originalBuffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("This file doesn't look like a valid .docx (missing word/document.xml).");
  }
  let xml = await documentXmlFile.async("string");

  const summary: AppliedFixSummary[] = [];

  for (const fix of fixes) {
    let applied = false;

    if (fix.action === "widen_blank") {
      // Try paragraphs first (a blank fill-in line outside a table), then
      // fall back to table cells (a bordered cell meant to be widened).
      const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
      const matchingParagraph = paragraphs.find((p) => extractParagraphText(p).includes(fix.targetText));
      if (matchingParagraph) {
        const widened = widenBlankInParagraph(matchingParagraph);
        if (widened) {
          xml = xml.replace(matchingParagraph, widened);
          applied = true;
        }
      }
      if (!applied) {
        const cells = xml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
        const matchingCell = cells.find((c) => extractParagraphText(c).includes(fix.targetText));
        if (matchingCell) {
          const widened = widenCellWidth(matchingCell);
          if (widened) {
            xml = xml.replace(matchingCell, widened);
            applied = true;
          }
        }
      }
    } else if (fix.action === "left_align") {
      const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
      const matchingParagraph = paragraphs.find((p) => extractParagraphText(p).includes(fix.targetText));
      if (matchingParagraph) {
        const aligned = leftAlignParagraph(matchingParagraph);
        xml = xml.replace(matchingParagraph, aligned);
        applied = true;
      }
    }

    summary.push({ fix, applied });
  }

  zip.file("word/document.xml", xml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return { buffer, summary };
}
