/**
 * Accreditation document requirements shown in the "Accreditation
 * requirements" modal on the order tracking page, opened from the
 * status panel's "View accepted accreditation documents" button.
 *
 * Unlike ACCOUNT_REQUIREMENTS (accountRequirements.ts, keyed per account
 * type), this content is the same for every investor account type -- it
 * only applies at all when the order's deal type is 506C (Reg D 506(c)).
 * 506-B and Reg A offerings don't require a separate accreditation
 * document upload (self-certification via KYC is enough for those), so
 * this modal and its "How to upload accreditation documents" button
 * should only ever be shown when dealType === "506C" -- see
 * blockingRequirement in lib/orderTracking.ts.
 *
 * Content confirmed directly from the user against the live prototype
 * (Oct 2026); not guessed.
 */

export interface AccreditationVerificationMethod {
  title: string;
  description: string;
  accepted: string[];
  /** Only the "Professional accreditation letter" method has this. */
  templateUrl?: string;
  templateLabel?: string;
}

export const ACCREDITATION_VERIFICATION_METHODS: AccreditationVerificationMethod[] = [
  {
    title: "Proof of income",
    description:
      "Your income must meet the applicable threshold for each of the two most recent tax years, and you must reasonably expect to meet it again this year.",
    accepted: [
      "Your IRS Form 1040 for both tax years, with your full legal name and signature",
      "Your W-2 forms for both tax years showing qualifying gross income",
      "Your Form 1099 as supporting evidence together with a 1040 or official bank statement",
    ],
  },
  {
    title: "Proof of net worth",
    description: "Use current, official statements showing your full legal name. Do not include your primary residence.",
    accepted: [
      "Official bank statement issued by the financial institution, not a mobile-app screenshot",
      "Brokerage or investment statement issued by the institution",
    ],
  },
  {
    title: "Professional accreditation letter",
    description:
      "Use this option when your CPA, licensed attorney or qualified adviser confirms your accreditation under Rule 501(a).",
    accepted: [
      "Your professional's firm letterhead",
      "Your professional's license number and signature",
      "Your full legal name as shown in AxisKey",
    ],
    templateUrl: "https://www.jotform.com/sign/262374088976069/invite/01m0z8dn9900bc7e1562c01aa7",
    templateLabel: "Use AxisKey accreditation letter template",
  },
];

export const ACCREDITATION_NOT_ACCEPTED = [
  "Mobile-app screenshots",
  "Schedule K-1 by itself",
  "Self-written income letters",
  "Excel files or self-made summaries",
];

export const ACCREDITATION_NOTICE =
  "Send official, complete documents. Your full legal name on each document must match your AxisKey account.";

export interface AccreditationQualifyingThreshold {
  label: string;
  amount: string;
  caption: string;
}

export const ACCREDITATION_QUALIFYING_THRESHOLDS: AccreditationQualifyingThreshold[] = [
  { label: "Individual income", amount: "$200,000+", caption: "per year" },
  { label: "Joint income", amount: "$300,000+", caption: "per year, combined" },
  { label: "Net worth", amount: "$1,000,000+", caption: "excluding your primary residence" },
];

export const ACCREDITATION_UPLOAD_GUIDE_URL =
  "https://scribehow.com/o/rgPHeCylRtO-qzNp1MO7Tw/viewer/How_to_Upload_Accreditation_Documents__Zw14s90ISJmhpE0RfKBX6w";
