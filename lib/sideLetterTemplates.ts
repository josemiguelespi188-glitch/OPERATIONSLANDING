export interface SideLetterTemplate {
  id: string;
  name: string;
  /** Prefills the "notes" field (see SideLetterRequestForm). */
  termsTemplate: string;
}

export const SIDE_LETTER_TEMPLATES: SideLetterTemplate[] = [
  {
    id: "double-distribution-payment",
    name: "Double Distribution Payment",
    termsTemplate:
      "Requesting a double distribution payment for the investor for [specify period].",
  },
  {
    id: "additional-yield-percentage",
    name: "Additional Yield Percentage",
    termsTemplate:
      "Requesting an additional distribution percentage of [X]% above the standard offering terms.",
  },
  {
    id: "temporary-yield-increase",
    name: "Temporary Yield Increase",
    termsTemplate:
      "Requesting a temporary increase in distribution percentage of [X]% for [duration].",
  },
  {
    id: "management-fee-waiver",
    name: "Management Fee Waiver",
    termsTemplate: "Requesting a waiver/adjustment of the management fee for this investor.",
  },
  {
    id: "minimum-investment-exception",
    name: "Minimum Investment Exception",
    termsTemplate: "Requesting an exception to reduce the minimum investment amount to [$X].",
  },
  {
    id: "reporting-waiver",
    name: "Reporting Waiver",
    termsTemplate:
      "Requesting an exception to the standard reporting requirements for this investor.",
  },
  {
    id: "custom-side-letter",
    name: "Custom Side Letter",
    termsTemplate: "",
  },
];
