import type { ReactNode } from "react";
import { AlertOctagon, Inbox, Loader2, RotateCw, type LucideIcon } from "lucide-react";
import { useI18n } from "../lib/i18n";

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-ink-faint">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

/** Erreur de chargement, avec bouton « Réessayer » si une action de reprise existe. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-status-critical/30 bg-status-critical/10 p-4 text-sm text-status-critical">
      <AlertOctagon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost btn-sm">
          <RotateCw className="h-3.5 w-3.5" aria-hidden /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}

/** État vide utile : explique la situation et propose l'action concrète suivante. */
export function EmptyState({
  message,
  title,
  icon: Icon = Inbox,
  action,
}: {
  /** Texte principal (compatibilité : seul paramètre historique). */
  message: string;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
      <Icon className="h-7 w-7 text-ink-faint" aria-hidden />
      {title && <p className="text-sm font-semibold text-ink">{title}</p>}
      <p className="max-w-md text-sm text-ink-soft">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-24 rounded-xl ${className}`} aria-hidden />;
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
