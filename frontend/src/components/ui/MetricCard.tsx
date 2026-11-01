import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { fadeUp } from "./Card";

type Accent = "ok" | "warning" | "critical" | "unknown" | "info" | "neutral";

const ACCENT: Record<Accent, { text: string; ring: string; glow: string; bg: string }> = {
  ok: { text: "text-status-ok", ring: "ring-status-ok/30", glow: "group-hover:shadow-[0_0_30px_-10px_#10B981]", bg: "bg-status-ok/10" },
  warning: { text: "text-status-warning", ring: "ring-status-warning/30", glow: "group-hover:shadow-[0_0_30px_-10px_#F59E0B]", bg: "bg-status-warning/10" },
  critical: { text: "text-status-critical", ring: "ring-status-critical/30", glow: "group-hover:shadow-[0_0_30px_-10px_#EF4444]", bg: "bg-status-critical/10" },
  unknown: { text: "text-status-unknown", ring: "ring-status-unknown/30", glow: "", bg: "bg-status-unknown/10" },
  info: { text: "text-status-info", ring: "ring-status-info/30", glow: "group-hover:shadow-[0_0_30px_-10px_#3B82F6]", bg: "bg-status-info/10" },
  neutral: { text: "text-ink", ring: "ring-border", glow: "", bg: "bg-bg-soft" },
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "neutral",
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: Accent;
  hint?: string;
}) {
  const a = ACCENT[accent];
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      className={cn("group card p-4 transition-shadow", a.glow)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
          <p className={cn("mt-2 text-3xl font-semibold", a.text)}>{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
        </div>
        <span className={cn("rounded-lg p-2 ring-1 ring-inset", a.bg, a.ring, a.text)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}

/** Petite stat compacte pour le bandeau supérieur. */
export function StatWidget({
  label,
  value,
  icon: Icon,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <div className="flex items-center gap-3 px-4">
      {Icon && (
        <span className={cn("rounded-lg p-2 ring-1 ring-inset", a.bg, a.ring, a.text)}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
        <p className={cn("text-lg font-semibold", a.text)}>{value}</p>
      </div>
    </div>
  );
}
