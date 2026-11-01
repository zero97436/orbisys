import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BucketPoint } from "../../lib/series";
import { AXIS, ChartTooltip } from "./ChartTooltip";
import { useI18n } from "../../lib/i18n";

/** Tranches sans mesure (availability = null) : trou dans la courbe, pas de 100 % fictif. */
export function AvailabilityChart({ data, height = 220 }: { data: BucketPoint[]; height?: number }) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS.stroke} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS.stroke} tick={AXIS.tick} minTickGap={28} />
        <YAxis domain={[0, 100]} stroke={AXIS.stroke} tick={AXIS.tick} width={48} unit="%" />
        <Tooltip content={<ChartTooltip unit="%" />} />
        <Area
          type="monotone"
          dataKey="availability"
          name={t("dash.availability")}
          connectNulls={false}
          dot={{ r: 2.5, strokeWidth: 0, fill: "#10B981" }}
          activeDot={{ r: 4 }}
          stroke="#10B981"
          strokeWidth={2}
          fill="url(#availGrad)"
          animationDuration={600}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
