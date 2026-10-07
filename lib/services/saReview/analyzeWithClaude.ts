import Anthropic from "@anthropic-ai/sdk";
import type { DocxEvidence } from "./extractDocx";
import { SA_REVIEW_CATEGORIES, type SaReviewFinding } from "./checklist";

const MODEL = "claude-sonnet-5-5";

const MAPPING_FIELDS_REFERENCE = `
General Fields: Checkbox, Yes/No Checkbox, Checkbox Group, Day, Day Name, Month, Month Name, Year, Input Field, Label Field.
Investment Fields: Sign Date, SSN/Tax ID, Primary Investment Account Name, Full Investment Account Name, Investment Account Type, Contact Name, Full Address, Email, Phone, Date of Birth, Offering Name, Security Class, Shares Subscribed, Price Per Share, Total Purchase Price, Initial, Signature, Second Signature.
Joint Account Fields: Joint Account Holders Name, Date of Birth, SSN/Tax ID, Email.
Corporation Fields: Date of Formation, State of Formation, EIN/Tax ID.
Custodian Fields: Custodian Name, Custodian Account Number, Custodian EIN/Tax ID.
Trust Account Fields: Trust Name, Date of Formation.
User Prefill Fields: Date, Name, Title, Initial, Signature.
Entity Countersign Fields: Day, Month Name, Date, Name, Title, Initial, Signature.
A field doesn't need an exact predefined type -- Input Field, Label Field, Checkbox, and Checkbox Group are valid wildcards when the specific field type doesn't exist.
`.trim();

const SYSTEM_PROMPT = `
You are reviewing a Subscription Agreement (SA) for AxisKey against its mapping-readiness checklist, before the deal/mapping team creates the DocuSign-style mapping. The central question for every category: can this information be mapped accurately, clearly, and consistently with the available tools, without needing manual corrections after mapping?

${MAPPING_FIELDS_REFERENCE}

You will be given extracted evidence from the document (plain text, table cell widths in dxa twentieths-of-a-point units, runs of underscores used as blank fill-in lines, highlighted/shaded text, literal dates found, security/unit class mentions, and investment fields that may already have a value instead of being blank). You do NOT have a visual render of the document -- reason from this structural evidence, and say so plainly in your "detail" text whenever the evidence is genuinely inconclusive for a category rather than guessing.

Score exactly these 7 categories. For each: status is "ok" (no issue found), "auto_fix" (a mechanical formatting problem that can be safely fixed without touching legal content), or "flag" (a content or legal decision that needs a human to resolve).

Rules that must not be broken:
- Never invent or guess the correct legal content of a blank, TBD, date, or pre-filled value. If something needs a human decision, it is "flag", never "auto_fix".
- Only categories 1 and 2 (space, alignment) can ever be "auto_fix" -- categories 3-7 are content/legal decisions and must always be "ok" or "flag", never "auto_fix", even if the fix seems obvious.
- "recommendedAction" is required whenever status is "flag" or "auto_fix", and should name exactly what to do and, where relevant, who should be asked (e.g. "Ask the project/client for a final version without TBDs" or "Widen the Investor Account Name field -- current line is too short for a typical IRA custodial name").
- Whenever category 1 or 2 is "auto_fix", also add one entry per specific instance to "mechanicalFixes" so the fix can be applied programmatically. "targetText" MUST be copied verbatim (exact substring, not paraphrased) from the evidence you were given (from a "context" field in blanks or tableCells) so it can be located again in the document text.
- "detail" should cite concrete evidence (quote the relevant snippet) rather than a generic description.

Categories to score, in order:
1. Insufficient space for variable information (names, addresses, emails, amounts) -- judge from blank underscore-run lengths and table cell widths (dxa) against a reasonable maximum length for that kind of data (e.g. a full IRA custodial account name can be 60+ characters).
2. Inconsistent field positioning or alignment -- with no visual render available, only flag this when the structural evidence itself shows something concrete (e.g. wildly inconsistent cell widths for fields of the same kind); otherwise mark "ok" and say in "detail" that alignment could not be fully assessed without a visual render.
3. Highlighted text, TBDs, and unresolved placeholders -- from the highlightedOrShaded and tbdMatches evidence.
4. Default or restrictive dates -- from literalDates evidence; only flag a date that plausibly represents an investor execution/sign date fixed to a specific year, not every 4-digit number (e.g. an offering's formation year or a fund name containing a year is not an issue).
5. Multiple security/unit classes or deal rooms -- from classMentions evidence; only an issue if multiple distinct classes appear with no clear mapping mechanism (checkbox/dropdown) to distinguish them.
6. Pre-populated investor commitments -- from possiblyPrefilledFields evidence (Shares Subscribed, Total Purchase Price, Price Per Share, Security Class already showing a value instead of blank).
7. Operating Agreement and entity countersignature compatibility -- from any Operating Agreement / countersignature / entity signature mentions in the text; flag if the structure looks like it needs more signers/fields than the available Entity Countersign Fields (Day, Month Name, Date, Name, Title, Initial, Signature) can support.

Respond by calling the submit_review tool exactly once, with "categories" containing exactly 7 entries, one per category above (category values 1 through 7, each appearing exactly once).
`.trim();

function buildUserMessage(evidence: DocxEvidence): string {
  return JSON.stringify(
    {
      plainTextExcerpt: evidence.plainText.slice(0, 12000),
      blanks: evidence.blanks.slice(0, 40),
      tableCells: evidence.tableCells.slice(0, 60),
      highlightedOrShaded: evidence.highlightedOrShaded.slice(0, 30),
      tbdMatches: evidence.tbdMatches.slice(0, 30),
      literalDates: evidence.literalDates.slice(0, 30),
      classMentions: evidence.classMentions.slice(0, 20),
      possiblyPrefilledFields: evidence.possiblyPrefilledFields.slice(0, 20),
    },
    null,
    2
  );
}

const SUBMIT_REVIEW_TOOL: Anthropic.Tool = {
  name: "submit_review",
  description: "Submit the completed mapping-readiness review.",
  // Claude Sonnet 5.5 (and other current models) reject a forced
  // tool_choice ({type: "tool"} / {type: "any"}) with a 400 -- the call
  // below uses tool_choice: "auto" plus an explicit system-prompt
  // instruction instead, and strict:true (requires additionalProperties:
  // false + required on every object level) keeps the output schema-valid
  // without the old forced-choice guarantee.
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "integer", minimum: 1, maximum: 7 },
            status: { type: "string", enum: ["ok", "auto_fix", "flag"] },
            detail: { type: "string" },
            recommendedAction: {
              type: ["string", "null"],
              description: "Required whenever status is \"flag\" or \"auto_fix\"; null when status is \"ok\".",
            },
          },
          required: ["category", "status", "detail", "recommendedAction"],
          additionalProperties: false,
        },
        // Strict mode only allows minItems/maxItems of 0 or 1 (a 400
        // otherwise) -- "exactly 7, one per category" is enforced by the
        // system prompt instead and double-checked at runtime below.
      },
      mechanicalFixes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "integer", enum: [1, 2] },
            targetText: { type: "string", description: "Exact substring copied verbatim from a blanks[].context or tableCells[].context value." },
            action: { type: "string", enum: ["widen_blank", "left_align"] },
            note: { type: ["string", "null"] },
          },
          required: ["category", "targetText", "action", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["categories", "mechanicalFixes"],
    additionalProperties: false,
  },
};

export interface MechanicalFix {
  category: 1 | 2;
  targetText: string;
  action: "widen_blank" | "left_align";
  note?: string;
}

export async function analyzeWithClaude(evidence: DocxEvidence): Promise<{
  mappingReady: boolean;
  findings: SaReviewFinding[];
  mechanicalFixes: MechanicalFix[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_REVIEW_TOOL],
    // Claude Sonnet 5.5 rejects a forced tool_choice (400) -- "auto" plus
    // the system prompt's explicit "call submit_review exactly once"
    // instruction is the supported replacement; strict:true on the tool
    // keeps the shape schema-valid once it is called.
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: buildUserMessage(evidence) }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured review.");
  }

  const input = toolUse.input as {
    categories: { category: number; status: SaReviewFinding["status"]; detail: string; recommendedAction: string | null }[];
    mechanicalFixes: (Omit<MechanicalFix, "note"> & { note: string | null })[];
  };

  const seenCategories = new Set(input.categories.map((c) => c.category));
  const missing = SA_REVIEW_CATEGORIES.map((c) => c.id).filter((id) => !seenCategories.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Claude's review was missing ${missing.length} of the 7 categories (${missing.join(", ")}). Try again.`
    );
  }

  const findings: SaReviewFinding[] = input.categories.map((c) => {
    const definition = SA_REVIEW_CATEGORIES.find((cat) => cat.id === c.category);
    return {
      category: c.category,
      label: definition?.label ?? `Category ${c.category}`,
      status: c.status,
      detail: c.detail,
      recommendedAction: c.recommendedAction ?? undefined,
    };
  });

  const mappingReady = findings.every((f) => f.status === "ok" || f.status === "auto_fix");

  const mechanicalFixes: MechanicalFix[] = input.mechanicalFixes.map((f) => ({
    category: f.category,
    targetText: f.targetText,
    action: f.action,
    note: f.note ?? undefined,
  }));

  return { mappingReady, findings, mechanicalFixes };
}
