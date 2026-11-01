import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartTooltip } from "./ChartTooltip";
import { useI18n } from "../../lib/i18n";

export function MetricArea({
  data,
  color = "#3B82F6",
  unit = "",
  id,
  height = 160,
  domain,
}: {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
  id: string;
  height?: number;
  domain?: [number, number];
}) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS.stroke} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS.stroke} tick={AXIS.tick} minTickGap={32} />
        <YAxis domain={domain ?? [0, "auto"]} stroke={AXIS.stroke} tick={AXIS.tick} width={42} unit={unit} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey="value"
          name={t("chart.value")}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${id})`}
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
