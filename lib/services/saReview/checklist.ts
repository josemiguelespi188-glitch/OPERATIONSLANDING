/**
 * The 7 substantive mapping-readiness categories, adapted from the
 * sa-mapping-review Claude Code skill (see its SKILL.md). Shared between
 * the Claude analysis prompt (analyzeWithClaude.ts) and the admin UI, so
 * the category numbers/labels shown in the report always match what the
 * model was actually asked to assess.
 *
 * Categories 1-2 are a Vercel-only approximation of the skill's visual
 * review (no LibreOffice render available here -- see extractDocx.ts);
 * categories 3-7 are the same text/XML-evidence-based checks the skill
 * itself uses. An 8th, computed "mapping ready" verdict (not a category
 * Claude scores individually) summarizes whether every category above is
 * "ok" or "auto_fix".
 */
export const SA_REVIEW_CATEGORIES = [
  {
    id: 1,
    label: "Insufficient space for variable information",
    autoFixable: true,
  },
  {
    id: 2,
    label: "Inconsistent field positioning or alignment",
    autoFixable: true,
  },
  {
    id: 3,
    label: "Highlighted text, TBDs, and unresolved placeholders",
    autoFixable: false,
  },
  {
    id: 4,
    label: "Default or restrictive dates",
    autoFixable: false,
  },
  {
    id: 5,
    label: "Multiple security/unit classes or deal rooms",
    autoFixable: false,
  },
  {
    id: 6,
    label: "Pre-populated investor commitments",
    autoFixable: false,
  },
  {
    id: 7,
    label: "Operating Agreement and entity countersignature compatibility",
    autoFixable: false,
  },
] as const;

export type SaReviewFindingStatus = "ok" | "auto_fix" | "flag";

export interface SaReviewFinding {
  category: number;
  label: string;
  status: SaReviewFindingStatus;
  detail: string;
  recommendedAction?: string;
}
