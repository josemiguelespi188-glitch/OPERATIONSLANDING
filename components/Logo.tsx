/**
 * Placeholder wordmark until the licensed AxisKey logo file is dropped
 * into /public. Swap this for an <Image src="/logo.svg" /> once assets
 * arrive — layout and sizing already match the header slot.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-axis-core">
        <span className="font-head text-sm font-bold tracking-tight text-axis-signal">
          AK
        </span>
      </span>
      <span className="font-head text-lg font-bold tracking-tight text-axis-core">
        AxisKey
      </span>
    </div>
  );
}
