import type { RequestTypeSlug } from "./requestTypes";

export type FormFieldType =
  | "text"
  | "email"
  | "number"
  | "currency"
  | "file"
  | "select"
  | "textarea";

export interface FormFieldConfig {
  id: string;
  label: string;
  required: boolean;
  helper?: string;
  type: FormFieldType;
  placeholder?: string;
  fullWidth?: boolean;
  options?: string[];
}

export interface RequestFormConfig {
  slug: RequestTypeSlug;
  title: string;
  descriptionLines: string[];
  fields: FormFieldConfig[];
}

/**
 * Field order below is the literal grid order: left-column-top-to-bottom,
 * right-column-top-to-bottom, interleaved row by row (L1, R1, L2, R2, ...)
 * so a plain 2-column CSS grid fills correctly without manual placement.
 * Copy is reproduced verbatim from the source spec — including the
 * informal phrasing — since these must match the live AxisKey forms.
 */
export const REQUEST_FORM_CONFIGS: Record<string, RequestFormConfig> = {
  "ira-funding-request": {
    slug: "ira-funding-request",
    title: "IRA Funding Request",
    descriptionLines: [
      "By filling out this form, IFT it's gonna request for the funds to the specific IRA custodian.",
      "In order to IFT follow this process. The client or Capital Raiser needs to fill out this form.",
    ],
    fields: [
      {
        id: "investorAccountName",
        label: "Investor Account Name",
        required: true,
        helper: "Make sure it's the same name on IFT system",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "dealName",
        label: "What's the deal name he is investing in?",
        required: true,
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "iraName",
        label: "IRA Name",
        required: true,
        helper: "IRA Name",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "investingAmount",
        label: "What's the investing amount?",
        required: true,
        type: "currency",
        placeholder: "Enter currency",
      },
      {
        id: "subscriptionAgreement",
        label: "Upload the Subscription Agreement",
        required: false,
        helper:
          "You will find this on IFT portal. Go to the investor order. It need to be completely sign.",
        type: "file",
      },
      {
        id: "orderNumber",
        label: "Order Number",
        required: false,
        helper: "You can find this number on IFT portal.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "ccEmail",
        label: "Add your email so you can be CC on the process",
        required: true,
        helper: "(Add your email so you can track this)",
        type: "email",
        placeholder: "Enter email",
        fullWidth: true,
      },
    ],
  },

  "title-transfer-request": {
    slug: "title-transfer-request",
    title: "CREATE A TITLE TRANSFER REQUEST ON AXISKEY",
    descriptionLines: [
      "A title transfer is the process of moving an existing investment order from one investor account to another, without affecting the order itself. The investment, amount, and terms remain exactly the same, only the account holding the order is updated in AxisKey's internal system and portal. The investor or authorized signatory must complete this form to initiate the change.",
    ],
    fields: [
      {
        id: "investorName",
        label: "Investor Name",
        required: true,
        helper:
          "Enter the full legal name of the investor who currently holds the investment order being transferred.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "investorEmail",
        label: "Investor email",
        required: true,
        helper:
          "Enter the email address of the investor account that will receive the transferred order.",
        type: "email",
        placeholder: "Enter email",
      },
      {
        id: "dealName",
        label: "What's the deal name invested in?",
        required: true,
        helper:
          "Enter the exact name of the deal or offering where the title transfer is being requested.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "orderNumber",
        label: "Order Number",
        required: false,
        helper:
          "If the title transfer is associated with a specific order, enter the corresponding order number.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "currentAccountName",
        label: "Current Investor Account Name",
        required: true,
        helper:
          "Enter the name currently registered on the AxisKey portal for this investment order. This is the holder name that will be replaced.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "newAccountName",
        label: "New Investor Account Name",
        required: true,
        helper: "Enter the New Name of the Account we are transfering",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "requesterEmail",
        label: "Requester Email",
        required: false,
        helper:
          "Enter your email address so you can track the status of this title transfer request and receive updates as it is processed.",
        type: "email",
        placeholder: "Enter email",
      },
      {
        id: "titleTransferComplete",
        label: "Title Transfer Complete",
        required: false,
        helper: "If there is a title Transfer Please Attach",
        type: "file",
      },
    ],
  },

  "redemption-request": {
    slug: "redemption-request",
    title: "CREATE A REDEMPTION REQUEST ON AXISKEY",
    descriptionLines: [
      "A redemption is the process of withdrawing all or part of an investor's capital from an investment. The investment amount or terms may change. The investor or authorized signatory must complete this form to initiate the request.",
    ],
    fields: [
      {
        id: "investorName",
        label: "Investor Name",
        required: true,
        helper:
          "Enter the full legal name of the investor who currently holds the investment order being transferred.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "investorEmail",
        label: "Investor email",
        required: true,
        helper:
          "Enter the email address of the investor account that will receive the transferred order.",
        type: "email",
        placeholder: "Enter email",
      },
      {
        id: "orderNumber",
        label: "Order Number",
        required: true,
        helper:
          "Enter the order number associated with the investment being transferred. You can find this on the AxisKey portal under the investor's order.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "offeringName",
        label: "What's the Offering name invested in?",
        required: true,
        helper:
          "Enter the exact name of the deal or offering where the title transfer is being requested.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "investorAccountName",
        label: "Investor account name",
        required: true,
        helper:
          "Enter the name currently registered on the AxisKey portal for this investment order.",
        type: "text",
        placeholder: "Enter text",
      },
      {
        id: "redemptionType",
        label: "Redemption type",
        required: true,
        helper: "Select whether this is a full or partial redemption of the investment.",
        type: "select",
        placeholder: "Select whether this is a full or partial redemption of the investment.",
        options: ["Full Redemption", "Partial Redemption"],
      },
      {
        id: "redemptionAmount",
        label: "Redemption amount (USD)",
        required: true,
        helper: "If partial, enter the exact amount to be redeemed in USD.",
        type: "number",
        placeholder: "Enter number",
      },
      {
        id: "notes",
        label: "Notes",
        required: false,
        helper:
          "Please explain the reason for the redemption request and any additional details relevant to processing it.",
        type: "textarea",
        placeholder: "Enter text",
        fullWidth: true,
      },
    ],
  },
};

export function getRequestFormConfig(slug: string): RequestFormConfig | undefined {
  return REQUEST_FORM_CONFIGS[slug];
}
