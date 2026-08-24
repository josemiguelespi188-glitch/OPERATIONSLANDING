import Image from "next/image";

/**
 * Official AxisKey wordmark (public/axiskey-logo.png) — monochrome,
 * transparent background, per §05 Logo System: "Monochrome applications
 * are primary. Logo may appear on White, Axis Core, or Axis Signal
 * backgrounds." Rendered at native aspect ratio (512×219); only height is
 * constrained so it never stretches or distorts.
 *
 * The source file is rendered in Axis Core (near-black), so on a dark
 * surface — the sidebar — variant="light" inverts it to white via a CSS
 * filter rather than shipping a second asset.
 */
export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Image
      src="/axiskey-logo.png"
      alt="AxisKey"
      width={512}
      height={219}
      priority
      className={`h-8 w-auto sm:h-9 ${variant === "light" ? "brightness-0 invert" : ""}`}
    />
  );
}
