import { useEffect, useMemo, useState } from "react";
import {
  Bell, BellOff, CheckCheck, Wrench, Wand2, Activity, Loader2, ChevronDown, AlertTriangle, GitBranch, History, Radar, type LucideIcon,
} from "lucide-react";
import { listEvents } from "../api/endpoints";
import type { EventLog } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Loading, EmptyState, ErrorState } from "../components/States";
import { SearchInput } from "../components/ui/ListControls";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { timeAgo, formatDate } from "../lib/format";
import { useI18n } from "../lib/i18n";

// label = clé i18n (ev.type.<x>), traduite au rendu.
const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  alert_opened: { label: "ev.type.alert_opened", icon: Bell },
  alert_resolved: { label: "ev.type.alert_resolved", icon: CheckCheck },
  alert_suppressed: { label: "ev.type.alert_suppressed", icon: BellOff },
  alert_acknowledged: { label: "ev.type.alert_acknowledged", icon: CheckCheck },
  alert_unacknowledged: { label: "ev.type.alert_unacknowledged", icon: Bell },
  maintenance_created: { label: "ev.type.maintenance_created", icon: Wrench },
  maintenance_deleted: { label: "ev.type.maintenance_deleted", icon: Wrench },
  remediation: { label: "ev.type.remediation", icon: Wand2 },
  alert_escalated: { label: "ev.type.alert_escalated", icon: AlertTriangle },
  alert_suppressed_dependency: { label: "ev.type.alert_suppressed_dependency", icon: GitBranch },
  alert_suppressed_flapping: { label: "ev.type.alert_suppressed_flapping", icon: History },
  discovery_import: { label: "ev.type.discovery_import", icon: Radar },
};

const LEVEL_COLOR: Record<string, string> = {
  info: "bg-status-info/15 text-status-info",
  warning: "bg-status-warning/15 text-status-warning",
  critical: "bg-status-critical/15 text-status-critical",
};

const FILTERS: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "common.all" },
  { value: "alert_opened", labelKey: "ev.f.alerts" },
  { value: "alert_acknowledged", labelKey: "ev.f.acks" },
  { value: "maintenance_created", labelKey: "ev.f.maintenance" },
  { value: "remediation", labelKey: "ev.f.remediation" },
  { value: "alert_escalated", labelKey: "ev.f.escalations" },
];

const PAGE = 50;

export default function EventsPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    setError(null);
    listEvents({ type: filter || undefined, level: level || undefined, limit: PAGE, offset: 0 })
      .then((r) => {
        setEvents(r.data);
        setHasMore(r.data.length === PAGE);
      })
      .catch(() => setError(t("common.loadError")))
      .finally(() => setLoading(false));
  }, [filter, level, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await listEvents({ type: filter || undefined, level: level || undefined, limit: PAGE, offset: events.length });
      setEvents((e) => [...e, ...data]);
      setHasMore(data.length === PAGE);
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.loadError")));
    } finally {
      setLoadingMore(false);
    }
  };

  // Recherche texte (message, acteur, libellé du type) côté client sur les événements chargés.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const label = (TYPE_META[e.type] ? t(TYPE_META[e.type].label) : e.type).toLowerCase();
      return e.message.toLowerCase().includes(q) || (e.actor ?? "").toLowerCase().includes(q) || label.includes(q);
    });
  }, [events, search, t]);

  return (
    <div className="space-y-6">
      <PageHeader titleKey="page.events.title" subtitleKey="page.events.sub" helpTopic="incidents" />

      {/* Recherche + niveau */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={t("ev.searchPh")} className="min-w-[220px] flex-1" />
        <select aria-label={t("ev.levelField")} value={level} onChange={(e) => setLevel(e.target.value)} className="input">
          <option value="">{t("ev.allLevels")}</option>
          <option value="info">{t("ev.info")}</option>
          <option value="warning">{t("ev.warning")}</option>
          <option value="critical">{t("ev.critical")}</option>
        </select>
      </div>

      <div role="group" aria-label={t("ev.typeField")} className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg-soft p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition",
              filter === f.value ? "bg-brand-soft text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {search && !loading && (
        <p className="text-xs text-ink-faint">{t("ev.searchScope").replace("{n}", String(events.length))}</p>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : shown.length === 0 ? (
        <EmptyState message={search ? t("ev.noneMatch") : t("ev.none")} />
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-border">
            {shown.map((e) => {
              const meta = TYPE_META[e.type] ?? { label: e.type, icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 rounded-lg p-1.5", LEVEL_COLOR[e.level] ?? LEVEL_COLOR.info)} title={t(`ev.${e.level}`)}>
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">{t(`ev.${e.level}`)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className="font-medium">{TYPE_META[e.type] ? t(meta.label) : e.type}</span>
                      {e.actor && e.actor !== "system" && <span className="text-ink-faint"> · {e.actor}</span>}
                    </p>
                    <p className="line-clamp-2 text-xs text-ink-soft" title={e.message}>{e.message}</p>
                    {(e.check_id || e.host_id) && (
                      <p className="mt-0.5 flex gap-3 text-[11px]">
                        {e.host_id && <Link to={`/hosts/${e.host_id}`} className="text-brand hover:underline">{t("ev.openHost")}</Link>}
                        {e.check_id && <Link to={`/checks/${e.check_id}`} className="text-brand hover:underline">{t("ev.openCheck")}</Link>}
                      </p>
                    )}
                  </div>
                  <time dateTime={e.created_at} className="shrink-0 text-[11px] text-ink-faint" title={formatDate(e.created_at)}>
                    {timeAgo(e.created_at)}
                  </time>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button type="button" onClick={loadMore} disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm text-ink-soft hover:text-ink">
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {t("ev.loadMore")}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
