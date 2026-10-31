import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Server,
  ServerCrash,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Gauge,
  ArrowRight,
  Activity,
  SlidersHorizontal,
  Save,
  RotateCcw,
  X,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  getAvailability,
  listChecks,
  listHosts,
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
  type LayoutSection,
} from "../api/endpoints";
import type { CheckStatus } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Card, SectionTitle, MotionGrid } from "../components/ui/Card";
import { HealthCard } from "../components/ui/HostCard";
import { AlertCard } from "../components/ui/AlertCard";
import { LiveEventFeed } from "../components/live/LiveEventFeed";
import { AiSummaryCard } from "../components/ai/AiSummaryCard";
import { AvailabilityChart } from "../components/charts/AvailabilityChart";
import { StatusDonut } from "../components/charts/StatusDonut";
import { EmptyState, ErrorState, SkeletonGrid } from "../components/States";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { buildHostViews, hostBuckets, overallStatus, prioritizeIncidents, SEVERITY_RANK } from "../lib/fleet";
import { availabilityStatus, statusMeta } from "../lib/status";
import { bucketsFromReport } from "../lib/series";
import { formatNumber, formatPercent } from "../lib/format";
import { useLiveStatus } from "../lib/liveStatus";
import { usePolling } from "../hooks/usePolling";
import { apiError, apiErrorMessage } from "../lib/apiError";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";
import { GettingStarted } from "../components/GettingStarted";
import { useAuth } from "../lib/auth";
import { canEdit, isAdmin } from "../lib/permissions";

const HOUR = 3600 * 1000;
/** Périodes proposées pour la disponibilité et la tendance (calcul serveur). */
const PERIODS = [
  { id: "24h", hours: 24, buckets: 24, labelKey: "dash.period.24h" },
  { id: "7d", hours: 24 * 7, buckets: 28, labelKey: "dash.period.7d" },
  { id: "30d", hours: 24 * 30, buckets: 30, labelKey: "dash.period.30d" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const DEFAULT_LAYOUT: LayoutSection[] = [
  { id: "hero", visible: true },
  { id: "kpi", visible: true },
  { id: "incidents", visible: true },
  { id: "trend", visible: true },
  { id: "fleet", visible: true },
];
const SECTION_TITLE: Record<string, string> = {
  hero: "dash.sec.hero",
  kpi: "dash.sec.kpis",
  incidents: "dash.sec.incidents",
  trend: "dash.sec.trend",
  fleet: "dash.sec.fleet",
};

export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  // Résumé + incidents : état partagé du shell (une seule requête, rafraîchie toutes les 20 s).
  const live = useLiveStatus();
  // Inventaire (hôtes + checks) : rafraîchi toutes les 30 s, pause onglet masqué.
  const fleet = usePolling(() => Promise.all([listHosts(), listChecks()]).then(([h, c]) => ({ hosts: h.data, checks: c.data })), 30000);
  const [periodId, setPeriodId] = useState<PeriodId>("24h");
  const period = PERIODS.find((p) => p.id === periodId)!;
  const avail = usePolling(() => getAvailability(period.hours, period.buckets).then((r) => r.data), 60000);
  // Changement de période : nouveau calcul (pas au premier rendu, déjà chargé par usePolling).
  const firstPeriod = useRef(true);
  useEffect(() => {
    if (firstPeriod.current) { firstPeriod.current = false; return; }
    avail.refresh();
  }, [periodId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dashboard personnalisable : ordre + visibilité des sections (par utilisateur).
  const [layout, setLayout] = useState<LayoutSection[]>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<LayoutSection[]>(DEFAULT_LAYOUT);
  const [customize, setCustomize] = useState(false);
  useEffect(() => {
    getDashboardLayout()
      .then((r) => { setLayout(r.data.sections); setSavedLayout(r.data.sections); })
      .catch(() => { /* disposition par défaut */ });
  }, []);

  const hostViews = useMemo(() => buildHostViews(fleet.data?.hosts ?? [], fleet.data?.checks ?? []), [fleet.data]);
  const hb = useMemo(() => hostBuckets(hostViews), [hostViews]);
  const [fleetFilter, setFleetFilter] = useState<"attention" | "all">("attention");

  const summary = live.summary;
  const incidents = useMemo(() => prioritizeIncidents(live.incidents ?? []), [live.incidents]);

  if ((live.loading && !summary) || (fleet.loading && !fleet.data)) return <SkeletonGrid count={6} />;
  if (!summary) return <ErrorState message={t("common.loadError")} onRetry={live.refresh} />;

  const c = summary.status_counts;
  const overall = overallStatus(c);
  const meta = statusMeta(overall);
  const unacked = incidents.filter((i) => !i.acknowledged).length;
  const criticalIncidents = incidents.filter((i) => i.status === "CRITICAL").length;
  const headline =
    overall === "CRITICAL" ? t("dash.head.critical")
    : overall === "WARNING" ? t("dash.head.watch")
    : overall === "UNKNOWN" ? t("dash.head.waiting")
    : t("dash.head.allOk");
  const subline =
    overall === "CRITICAL" ? `${c.CRITICAL} ${t("dash.criticalServices")} · ${incidents.length} ${t("dash.activeIncidents")}`
    : overall === "WARNING" ? `${c.WARNING} ${t("dash.warningsOngoing")}`
    : overall === "UNKNOWN" ? t("dash.sub.noRecent")
    : t("dash.sub.noIncident");

  const pct = avail.data?.availability ?? null;
  const pctStatus = statusMeta(availabilityStatus(pct));
  const pctLabel = pct == null ? "—" : formatPercent(pct, 1);
  const trend = avail.data ? bucketsFromReport(avail.data.buckets, period.hours * HOUR) : [];
  const attention = hostViews.filter((h) => h.status !== "OK").sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status]);
  const fleetList = fleetFilter === "attention" ? attention : [...hostViews].sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...layout];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setLayout(next);
  };
  const toggle = (idx: number) => {
    const next = [...layout];
    next[idx] = { ...next[idx], visible: !next[idx].visible };
    setLayout(next);
  };
  const cancelLayout = () => { setLayout(savedLayout); setCustomize(false); };
  const saveLayout = async () => {
    try {
      await saveDashboardLayout(layout);
      setSavedLayout(layout);
      setCustomize(false);
      toast.success(t("common.saved"));
    } catch (e) {
      if (apiError(e).status === 403) { toast.info(t("dash.proOnly")); cancelLayout(); }
      else toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
  };
  const resetLayout = async () => {
    if (!(await confirm({ title: t("dash.resetTitle"), message: t("dash.resetBody"), tone: "primary", confirmLabel: t("dash.default") }))) return;
    try {
      await resetDashboardLayout();
      setLayout(DEFAULT_LAYOUT);
      setSavedLayout(DEFAULT_LAYOUT);
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
  };

  const periodSwitch = (
    <div role="group" aria-label={t("dash.period")} className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
      {PERIODS.map((p) => (
        <button key={p.id} type="button" aria-pressed={periodId === p.id} onClick={() => setPeriodId(p.id)}
          className={cn("whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold", periodId === p.id ? "bg-brand text-white" : "text-ink-faint hover:text-ink")}>
          {t(p.labelKey)}
        </button>
      ))}
    </div>
  );

  const SECTIONS: Record<string, ReactNode> = {
    hero: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* État global */}
        <div className="card relative overflow-hidden p-5 sm:p-6 lg:col-span-2"
          style={{ background: `linear-gradient(135deg, ${meta.color}14, transparent 60%)` }}>
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl sm:h-14 sm:w-14"
              style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
              <meta.icon className="h-7 w-7" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("eyebrow", meta.text)}>{t(`status.${overall}`)}</p>
              <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{headline}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{subline}</p>
            </div>
            {incidents.length > 0 && (
              <Link to="/incidents" className="btn-primary shrink-0">
                {t("dash.handle")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <HeroStat label={t("dash.hostsTotal")} value={summary.hosts_total} to="/hosts" />
            <HeroStat label={t("dash.checksTotal")} value={summary.checks_total} to="/checks" />
            <HeroStat label={t("dash.critIncidents")} value={criticalIncidents} to="/incidents" className={criticalIncidents ? "text-status-critical" : undefined} />
            <HeroStat label={t("dash.unacked")} value={unacked} to="/incidents" className={unacked ? "text-status-warning" : undefined} />
          </dl>
        </div>

        {/* Disponibilité réelle (serveur) */}
        <div className="card flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle title={t("dash.availability")} icon={Gauge} />
            {periodSwitch}
          </div>
          {avail.error && !avail.data ? (
            <ErrorState message={t("common.loadError")} onRetry={avail.refresh} />
          ) : (
            <>
              <div className="flex flex-1 flex-col items-center justify-center py-1 text-center">
                <span className={cn("text-5xl font-bold", pctStatus.text)}>{pctLabel}</span>
                <span className="mt-1 text-xs text-ink-faint">
                  {pct == null
                    ? t("dash.noMeasure")
                    : t("dash.basedOn").replace("{n}", formatNumber(avail.data?.total ?? 0)).replace("{period}", t(period.labelKey))}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-soft" aria-hidden>
                <div className={cn("h-full rounded-full transition-all", pctStatus.dot)} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    ),
    kpi: (
      <MotionGrid className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t("dash.hostsOk")} hint={t("dash.hostsOkHint")} value={hb.OK} status="OK" icon={Server} to="/hosts" />
        <Kpi label={t("dash.hostsCritical")} hint={t("dash.hostsCriticalHint")} value={hb.CRITICAL} status="CRITICAL" icon={ServerCrash} to="/hosts" />
        <Kpi label={t("dash.checksOk")} value={c.OK ?? 0} status="OK" icon={CheckCircle2} to="/checks" />
        <Kpi label={t("dash.checksWarning")} value={c.WARNING ?? 0} status="WARNING" icon={AlertTriangle} to="/incidents" />
        <Kpi label={t("dash.checksCritical")} value={c.CRITICAL ?? 0} status="CRITICAL" icon={XCircle} to="/incidents" />
        <Kpi label={t("dash.checksUnknown")} value={c.UNKNOWN ?? 0} status="UNKNOWN" icon={HelpCircle} to="/checks" />
      </MotionGrid>
    ),
    incidents: (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title={`${t("dash.priorityIncidents")} (${incidents.length})`}
            icon={AlertTriangle}
            action={incidents.length > 6 ? <Link to="/incidents" className="text-xs text-brand hover:underline">{t("dash.seeAll")}</Link> : undefined}
          />
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-status-ok" aria-hidden />
              <p className="text-sm font-medium text-status-ok">{t("dash.allUnderControl")}</p>
              <p className="text-xs text-ink-faint">{t("dash.noIncidentNow")}</p>
            </div>
          ) : (
            <MotionGrid className="grid grid-cols-1 gap-3">
              {incidents.slice(0, 6).map((inc) => (
                <AlertCard key={inc.alert_id} incident={inc} acknowledged={inc.acknowledged} />
              ))}
            </MotionGrid>
          )}
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle title={t("dash.stateBreakdown")} />
            <StatusDonut counts={c} />
          </Card>
          <Card>
            <LiveEventFeed height={220} />
          </Card>
        </div>
      </div>
    ),
    trend: (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title={`${t("dash.trend")} — ${t(period.labelKey)}`} icon={Activity} action={periodSwitch} />
          {avail.data && avail.data.total === 0 ? (
            <EmptyState icon={Activity} message={t("dash.noMeasure")} />
          ) : (
            <AvailabilityChart data={trend} />
          )}
        </Card>
        <div className="lg:col-span-1">
          <AiSummaryCard />
        </div>
      </div>
    ),
    fleet: (
      <Card>
        <SectionTitle
          title={`${t("dash.sec.fleet")} — ${hostViews.length} ${t("dash.hostsTotal").toLowerCase()}`}
          icon={Server}
          action={hostViews.length > 0 ? (
            <div role="group" aria-label={t("dash.sec.fleet")} className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
              {(["attention", "all"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={fleetFilter === f} onClick={() => setFleetFilter(f)}
                  className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", fleetFilter === f ? "bg-brand text-white" : "text-ink-faint hover:text-ink")}>
                  {f === "attention" ? `${t("dash.fleet.attention")} (${attention.length})` : t("common.all")}
                </button>
              ))}
            </div>
          ) : undefined}
        />
        {hostViews.length === 0 ? (
          <EmptyState icon={Server} title={t("dash.noHosts")} message={t("dash.noHostsHint")}
            action={<Link to="/hosts" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("dash.addHost")}</Link>} />
        ) : fleetList.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-status-ok">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("dash.fleet.noneAttention")}
          </p>
        ) : (
          <MotionGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {fleetList.map((h) => <HealthCard key={h.id} host={h} />)}
          </MotionGrid>
        )}
      </Card>
    ),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        helpTopic="dashboard"
        titleKey="dash.title"
        subtitleKey="dash.subtitle"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={overall} />
            {!customize ? (
              <button type="button" onClick={() => setCustomize(true)} className="btn-ghost" title={t("dash.customizeHint")}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> {t("dash.customize")}
              </button>
            ) : (
              <>
                <button type="button" onClick={resetLayout} className="btn-ghost text-ink-faint" title={t("dash.defaultHint")}>
                  <RotateCcw className="h-4 w-4" aria-hidden /> {t("dash.default")}
                </button>
                <button type="button" onClick={cancelLayout} className="btn-ghost">
                  <X className="h-4 w-4" aria-hidden /> {t("common.cancel")}
                </button>
                <button type="button" onClick={saveLayout} className="btn-primary">
                  <Save className="h-4 w-4" aria-hidden /> {t("common.save")}
                </button>
              </>
            )}
          </div>
        }
      />

      <GettingStarted
        hosts={summary.hosts_total}
        checks={summary.checks_total}
        hasResults={(avail.data?.total ?? 0) > 0}
        canEdit={canEdit(user)}
        isAdmin={isAdmin(user)}
      />

      {layout.map((s, i) => {
        const node = SECTIONS[s.id];
        if (!node) return null;
        if (!customize) return s.visible ? <section key={s.id} aria-label={t(SECTION_TITLE[s.id] ?? s.id)}>{node}</section> : null;
        const title = SECTION_TITLE[s.id] ? t(SECTION_TITLE[s.id]) : s.id;
        return (
          <div key={s.id} className={cn("relative rounded-2xl border border-dashed border-border p-3 pt-11 transition-opacity", !s.visible && "opacity-40")}>
            <div className="absolute left-3 right-3 top-2 flex items-center justify-between">
              <span className="eyebrow text-ink-soft">{title}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="icon-btn h-8 w-8" aria-label={`${t("dash.moveUp")} : ${title}`}>
                  <ChevronUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === layout.length - 1} className="icon-btn h-8 w-8" aria-label={`${t("dash.moveDown")} : ${title}`}>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => toggle(i)} className="icon-btn h-8 w-8" aria-pressed={!s.visible}
                  aria-label={`${s.visible ? t("dash.hide") : t("dash.show")} : ${title}`}>
                  {s.visible ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
            {node}
          </div>
        );
      })}
    </div>
  );
}

function HeroStat({ label, value, to, className }: { label: string; value: number; to: string; className?: string }) {
  return (
    <Link to={to} className="rounded-lg p-1 -m-1 transition hover:bg-bg-soft/60">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={cn("mt-0.5 text-xl font-bold tabular-nums text-ink", className)}>{formatNumber(value)}</dd>
    </Link>
  );
}

/** Indicateur cliquable : icône + nombre + libellé ; couleur seulement si la valeur est non nulle. */
function Kpi({ label, hint, value, status, icon: Icon, to }: {
  label: string; hint?: string; value: number; status: CheckStatus; icon: LucideIcon; to: string;
}) {
  const m = statusMeta(status);
  const active = value > 0;
  return (
    <Link to={to} title={hint}
      className={cn("card flex items-center gap-3 p-3 ring-1 ring-inset transition hover:-translate-y-0.5 hover:border-ink-faint",
        active ? m.soft.split(" ").filter((c) => c.startsWith("ring-")).join(" ") : "ring-transparent")}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? m.soft : "bg-bg-soft text-ink-faint")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-2xl font-bold leading-none tabular-nums", active ? m.text : "text-ink-soft")}>{formatNumber(value)}</span>
        <span className="mt-1 block text-[11px] uppercase leading-tight tracking-wide text-ink-faint">{label}</span>
      </span>
    </Link>
  );
}
