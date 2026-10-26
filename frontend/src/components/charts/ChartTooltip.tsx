import type { TooltipProps } from "recharts";

export const AXIS = {
  stroke: "#1F2937",
  tick: { fill: "#64748B", fontSize: 11 },
};

export function ChartTooltip({ active, payload, label, unit }: TooltipProps<number, string> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-bg-soft/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      {label != null && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-soft">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-ink">
            {p.value == null ? "—" : `${p.value}${unit ?? ""}`}
          </span>
        </p>
      ))}
    </div>
  );
}
