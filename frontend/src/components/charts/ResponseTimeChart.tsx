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
import { useI18n } from "../../lib/i18n";

export function ResponseTimeChart({
  data,
  height = 220,
}: {
  data: { label: string; ms: number }[];
  height?: number;
}) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS.stroke} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS.stroke} tick={AXIS.tick} minTickGap={28} />
        <YAxis stroke={AXIS.stroke} tick={AXIS.tick} width={56} unit="ms" />
        <Tooltip content={<ChartTooltip unit=" ms" />} />
        <Line
          type="monotone"
          dataKey="ms"
          name={t("chart.responseTime")}
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
