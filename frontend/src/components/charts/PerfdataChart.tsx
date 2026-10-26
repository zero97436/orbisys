import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartTooltip } from "./ChartTooltip";

export function PerfdataChart({
  data,
  name,
  color = "#8B5CF6",
  height = 220,
}: {
  data: { label: string; value: number }[];
  name: string;
  color?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-ink-faint">
        Aucune donnée numérique pour cette métrique.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS.stroke} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS.stroke} tick={AXIS.tick} minTickGap={28} />
        <YAxis stroke={AXIS.stroke} tick={AXIS.tick} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={false} animationDuration={500} />
      </LineChart>
    </ResponsiveContainer>
  );
}
