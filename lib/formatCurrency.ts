/**
 * Live-formats a dollar amount as the user types: strips anything but
 * digits and a single decimal point, then adds thousands separators to
 * the integer part (e.g. "50000" -> "50,000") so amounts are easy to
 * read at a glance instead of a long run of digits. Shared by
 * components/axiskey-forms/FormShell.tsx and
 * components/dynamic-forms/DynamicFormRenderer.tsx so every currency
 * field on the platform formats the same way.
 */
export function formatCurrencyInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }

  const [integerPart, decimalPart] = cleaned.split(".");
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart !== undefined ? `${withThousands}.${decimalPart}` : withThousands;
}
