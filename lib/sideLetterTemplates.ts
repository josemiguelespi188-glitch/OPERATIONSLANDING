export interface SideLetterTemplate {
  id: string;
  name: string;
  /** Must match one of the "Requested Side Letter Type" dropdown options. */
  sideLetterType: string;
  descriptionTemplate: string;
}

export const SIDE_LETTER_TYPE_OPTIONS: string[] = [
  "Additional Distribution Percentage",
  "Temporary Additional Distribution Percentage",
  "Distribution Deferral",
  "Double Distribution Payment",
  "Reduced Minimum Investment",
  "Waiver Request",
  "Management Fee Adjustment",
  "Reporting Exception",
  "Other",
];

export const SIDE_LETTER_TEMPLATES: SideLetterTemplate[] = [
  {
    id: "double-distribution-payment",
    name: "Double Distribution Payment",
    sideLetterType: "Double Distribution Payment",
    descriptionTemplate:
      "Requesting a double distribution payment for the investor for [specify period].",
  },
  {
    id: "additional-yield-percentage",
    name: "Additional Yield Percentage",
    sideLetterType: "Additional Distribution Percentage",
    descriptionTemplate:
      "Requesting an additional distribution percentage of [X]% above the standard offering terms.",
  },
  {
    id: "temporary-yield-increase",
    name: "Temporary Yield Increase",
    sideLetterType: "Temporary Additional Distribution Percentage",
    descriptionTemplate:
      "Requesting a temporary increase in distribution percentage of [X]% for [duration].",
  },
  {
    id: "management-fee-waiver",
    name: "Management Fee Waiver",
    sideLetterType: "Management Fee Adjustment",
    descriptionTemplate: "Requesting a waiver/adjustment of the management fee for this investor.",
  },
  {
    id: "minimum-investment-exception",
    name: "Minimum Investment Exception",
    sideLetterType: "Reduced Minimum Investment",
    descriptionTemplate:
      "Requesting an exception to reduce the minimum investment amount to [$X].",
  },
  {
    id: "reporting-waiver",
    name: "Reporting Waiver",
    sideLetterType: "Reporting Exception",
    descriptionTemplate:
      "Requesting an exception to the standard reporting requirements for this investor.",
  },
  {
    id: "custom-side-letter",
    name: "Custom Side Letter",
    sideLetterType: "Other",
    descriptionTemplate: "",
  },
];
