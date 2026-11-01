import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Server, Activity, Pencil } from "lucide-react";
import type { CheckStatus, Host } from "../../types";
import { statusMeta } from "../../lib/status";
import { uptimeSince } from "../../lib/format";
import { cn } from "../../lib/cn";
import { fadeUp } from "./Card";
import { StatusDot } from "./StatusBadge";
import { useI18n } from "../../lib/i18n";

interface HostView extends Host {
  status: CheckStatus;
  checksCount?: number;
}

/** Tuile compacte pour la matrice Health Overview. */
export function HealthCard({ host }: { host: HostView }) {
  const { t } = useI18n();
  const meta = statusMeta(host.status);
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -2 }}>
      <Link
        to={`/hosts/${host.id}`}
        className={cn(
          "block rounded-lg border bg-card p-3 transition",
          "border-l-4 hover:border-ink-faint/60",
        )}
        style={{ borderLeftColor: meta.color }}
      >
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-ink">{host.name}</span>
          <StatusDot status={host.status} pulse={host.status === "CRITICAL"} label={t(`status.${host.status}`)} />
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">{host.hostname_or_ip}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
          <span className="rounded bg-bg-soft px-1.5 py-0.5">{host.environment}</span>
          <span title={t("hosts.monitoredSince")}>{uptimeSince(host.created_at)}</span>
        </div>
      </Link>
    </motion.div>
  );
}

/** Carte riche pour la liste des hôtes. */
export function HostCard({
  host,
  onDelete,
  onEdit,
}: {
  host: HostView;
  onDelete?: (id: number) => void;
  onEdit?: (host: HostView) => void;
}) {
  const { t } = useI18n();
  const meta = statusMeta(host.status);
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2 }}
      className="group card overflow-hidden p-0"
    >
      <div className="h-1" style={{ backgroundColor: meta.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <Link to={`/hosts/${host.id}`} className="flex items-center gap-2">
            <span className={cn("rounded-lg p-2", meta.soft)}>
              <Server className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-ink group-hover:text-brand">{host.name}</p>
              <p className="font-mono text-xs text-ink-faint">{host.hostname_or_ip}</p>
            </div>
          </Link>
          <StatusDot status={host.status} pulse={host.status === "CRITICAL"} label={t(`status.${host.status}`)} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label={t("common.env")} value={host.environment} />
          <Stat label={t("common.checks")} value={host.checksCount ?? "—"} />
          <Stat label={t("hosts.monitoredSince")} value={uptimeSince(host.created_at)} />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-faint">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" aria-hidden />
            {t(`status.${host.status}`)}
          </span>
          <span className="flex items-center gap-3">
            {onEdit && (
              <button
                type="button"
                aria-label={`${t("common.edit")} ${host.name}`}
                onClick={() => onEdit(host)}
                className="flex items-center gap-1 text-ink-soft hover:text-brand"
              >
                <Pencil className="h-3 w-3" /> {t("common.edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                aria-label={`${t("common.delete")} ${host.name}`}
                onClick={() => onDelete(host.id)}
                className="text-status-critical/80 hover:text-status-critical"
              >
                {t("common.delete")}
              </button>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-bg-soft py-1.5">
      <p className="text-[10px] uppercase text-ink-faint">{label}</p>
      <p className="truncate text-xs font-medium text-ink-soft">{value}</p>
    </div>
  );
}

export type { HostView };
