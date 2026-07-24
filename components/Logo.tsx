/**
 * AxisKey wordmark — per the Brand Identity Guidelines (§05 Logo System),
 * the master mark itself must never be recreated or redrawn ("Do not
 * recreate or redraw the logo"). No logo asset file (SVG/PNG/AI) has been
 * supplied yet, only the written guidelines, so this renders the product
 * name as a clean typographic mark rather than inventing an icon.
 *
 * Swap-in instructions once the real asset arrives:
 *   - Drop the approved file(s) into /public (e.g. /public/logo.svg,
 *     /public/logo-mark.svg for the standalone Axis Icon).
 *   - Use the "AxisKey Primary Lockup" (product name beneath the Axis
 *     mark) as the default; fall back to the "Secondary Lockup" (name to
 *     the right, larger) only where the primary becomes illegible at
 *     small sizes.
 *   - Preserve clear space of 2× the width of the "I" in the Axis mark
 *     on all sides (§05 Clear Space Rule).
 *   - Align by the optical centre of the mark (centre of the "X"), not
 *     the bounding box (§05 Alignment & Placement).
 *   - Monochrome only: the mark may sit on White, Axis Core, or Axis
 *     Signal backgrounds — never on patterned/photographic backgrounds
 *     without sufficient contrast.
 */
export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const color = variant === "dark" ? "text-axis-core" : "text-white";

  return (
    <span
      className={`font-head text-xl font-medium tracking-tight ${color}`}
      style={{ letterSpacing: "-0.01em" }}
    >
      AxisKey
    </span>
  );
}
