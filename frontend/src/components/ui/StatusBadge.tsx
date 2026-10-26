import type { CheckStatus } from "../../types";
import { statusMeta } from "../../lib/status";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export function StatusBadge({
  status,
  label,
  size = "sm",
}: {
  status?: CheckStatus | null;
  label?: string;
  size?: "xs" | "sm";
}) {
  const { t } = useI18n();
  const s = status ?? "UNKNOWN";
  const meta = statusMeta(s);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        meta.soft,
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Icon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {label ?? t(`status.${s}`)}
    </span>
  );
}

/** Pastille de statut. Toujours accompagnée d'un texte : soit visible à côté,
 *  soit fourni ici via `label` (annoncé aux lecteurs d'écran). */
export function StatusDot({ status, pulse, label }: { status?: CheckStatus | null; pulse?: boolean; label?: string }) {
  const meta = statusMeta(status);
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {pulse && (
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping", meta.dot)} />
      )}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", meta.dot)} />
    </span>
  );
}
