/**
 * Structured document requirements per account type, shown in the
 * "Requirements for <account type>" modal on the order tracking page.
 * Ported from the shared HTML design prototype (Track_Your_Investment_
 * _AxisKey.html)'s ACCOUNT_TYPES data, keyed to match the exact account
 * type labels this app already decodes in lib/orderTracking.ts
 * (ACCOUNT_TYPE_BY_INDEX) from ClickUp's accountTypeName dropdown.
 *
 * This is deliberately a separate, richer knowledge base from ClickUp's
 * own "Docs needed" field text (still shown as the short next-step
 * guidance) -- the modal exists to give a structured, example-driven
 * breakdown (accepted vs not accepted documents) that a single free-text
 * ClickUp field can't represent well.
 */

export interface AccountRequirementDocument {
  title: string;
  description: string;
  accepted?: string[];
  notAccepted?: string[];
  options?: string[];
  includes?: string[];
}

export interface AccountRequirement {
  count: string;
  documents: AccountRequirementDocument[];
  notice?: string;
}

const PHOTO_ID_ACCEPTED = [
  "U.S. driver's license (any state)",
  "U.S. or international passport",
  "National ID card with photo and expiration date",
];

const PHOTO_ID_NOT_ACCEPTED = [
  "Expired documents of any kind",
  "Foreign national ID alone (such as a cedula)",
  "Student ID, employee badge or insurance card",
  "Screenshots of digital IDs or phone screens",
  "Blurry, cropped or partly hidden images",
];

const photoIdDocument = (description: string): AccountRequirementDocument => ({
  title: "Government-issued photo ID",
  description,
  accepted: PHOTO_ID_ACCEPTED,
  notAccepted: PHOTO_ID_NOT_ACCEPTED,
});

export const ACCOUNT_REQUIREMENTS: Record<string, AccountRequirement> = {
  Individual: {
    count: "1 document",
    documents: [
      photoIdDocument(
        "Upload one valid photo ID. Your full legal name must match your AxisKey account exactly. Do not use a nickname or abbreviation."
      ),
    ],
  },
  "IRA or Similar Benefit Plan": {
    count: "1 document",
    documents: [
      photoIdDocument(
        "Upload one valid photo ID. Your full legal name must match your AxisKey account exactly."
      ),
    ],
  },
  "401K": {
    count: "1 document",
    documents: [
      photoIdDocument(
        "Upload one valid photo ID. Your full legal name must match your AxisKey account exactly."
      ),
    ],
    notice: "401(k) plans do not need a custodian document. Only the photo ID is required.",
  },
  "Joint Account": {
    count: "2 photo IDs",
    documents: [
      {
        title: "Photo ID for each holder",
        description:
          "Upload two IDs in total, one for each holder. Upload them separately in your portal. The name on each ID must match that holder's name on your account.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
    ],
    notice: "Your account verification stays incomplete until both IDs are received and match your account.",
  },
  "Revocable Trust": {
    count: "2 documents",
    documents: [
      {
        title: "Photo ID of the trustee",
        description:
          "Upload a photo ID for each trustee who manages your trust. Each legal name must match your AxisKey account records.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
      {
        title: "Full Trust Agreement",
        description:
          "Upload your complete agreement. Excerpts, summaries and certification letters are not accepted. It must include:",
        includes: [
          "Your trust's full legal name, matching your AxisKey account name",
          "Each trustee's name and current mailing address",
          "Your beneficiaries' names",
          "Your trustee's authority to make investment decisions",
          "The date your trust was established",
        ],
      },
    ],
    notice: "If the trustee addresses are not in the agreement, also send a separate trustee certification that lists them.",
  },
  "Irrevocable Trust": {
    count: "2 documents",
    documents: [
      {
        title: "Photo ID of the trustee",
        description:
          "Upload a photo ID for each trustee who manages your trust. Each legal name must match your AxisKey account records.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
      {
        title: "Full Trust Agreement",
        description:
          "Upload your complete agreement. Excerpts, summaries and certification letters are not accepted. It must include:",
        includes: [
          "Your trust's full legal name, matching your AxisKey account name",
          "Each trustee's name and current mailing address",
          "Your beneficiaries' names",
          "Your trustee's authority to make investment decisions",
          "The date your trust was established",
        ],
      },
    ],
    notice: "If the trustee addresses are not in the agreement, also send a separate trustee certification that lists them.",
  },
  "Corporations/Partnerships": {
    count: "2 required items",
    documents: [
      {
        title: "Photo ID of the authorized signer",
        description:
          "If you sign for your entity, upload your photo ID. Your name on the ID must match your AxisKey record.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
      {
        title: "Proof of ownership/membership of your corporation or partnership",
        description:
          "Upload evidence that connects your full legal name to your corporation or partnership and shows your ownership, membership or signing authority. Use one of these when it includes both your name and your entity's legal name:",
        options: ["Articles of Incorporation or formation documents", "Operating Agreement", "Memorandum of Association"],
        includes: [
          "Your full legal name and your entity's legal name",
          "Your ownership, membership, management role or authority to sign",
        ],
      },
    ],
    notice:
      "If your Articles do not name you, use an Operating Agreement or Memorandum of Association that does. If you own less than 25%, you may need additional proof of management authority.",
  },
  "Non-Profit Entity": {
    count: "2 required items",
    documents: [
      {
        title: "Photo ID of the authorized representative",
        description:
          "If you are authorized to act for your nonprofit, upload your photo ID. Your name must match your AxisKey record.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
      {
        title: "Proof of your relationship with the nonprofit",
        description:
          "Upload evidence that links your full legal name to your nonprofit and confirms your role or signing authority. Use one of these when it shows both your name and your nonprofit's legal name:",
        options: ["Articles of Incorporation naming you", "Board resolution", "Other official authority document"],
        includes: ["Your full legal name and your nonprofit's legal name", "Your role or authority to act for your nonprofit"],
      },
    ],
  },
  "Disregarded Entity": {
    count: "2 required items",
    documents: [
      {
        title: "Photo ID of the authorized representative",
        description:
          "If you are authorized to act for your entity, upload your photo ID. Your name must match your AxisKey record.",
        accepted: PHOTO_ID_ACCEPTED,
        notAccepted: PHOTO_ID_NOT_ACCEPTED,
      },
      {
        title: "Proof of your relationship with the disregarded entity",
        description:
          "Upload evidence that links your full legal name to your entity and confirms your role or signing authority. Use one of these when it shows both your name and your entity's legal name:",
        options: [
          "Formation or incorporation documents naming you",
          "Operating Agreement",
          "Board resolution or other authority document",
        ],
        includes: ["Your full legal name and your entity's legal name", "Your role or authority to act for your entity"],
      },
    ],
    notice: "Upload your relationship documents under the Articles of Incorporation field in your portal.",
  },
};

export const DOCUMENT_UPLOAD_GUIDE_URL =
  "https://scribehow.com/o/rgPHeCylRtO-qzNp1MO7Tw/viewer/How_to_Upload_Documents_in_Investor_Accounts__maKfFR0rQJ6KWeBxGPahew";
