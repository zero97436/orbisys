import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, CalendarClock, Cpu, Gauge, GitBranch, Globe, History, ListChecks, MemoryStick,
  HardDrive, Network, Pencil, Plus, Server, Radio, Tag, Terminal, Thermometer, Copy, Check as CheckIcon,
} from "lucide-react";
import { getHost, getHostMetrics, getHostMetricsHourly, listChecks, listHosts, listResults, getHostEnrollment, type HostEnrollment } from "../api/endpoints";
import type { Host, HostMetric, HostMetricHourly } from "../types";
import { useAuth } from "../lib/auth";
import { canEdit, isAdmin } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { usePolling } from "../hooks/usePolling";
import { useLiveStatus } from "../lib/liveStatus";
import { apiError } from "../lib/apiError";
import { prioritizeIncidents, SEVERITY_RANK } from "../lib/fleet";
import { metaFor } from "../lib/checkMeta";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle, MotionGrid } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { AlertCard } from "../components/ui/AlertCard";
import { HostForm } from "../components/hosts/HostForm";
import { MetricArea } from "../components/charts/MetricArea";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { statusMeta, worstStatus } from "../lib/status";
import { uptimeSince, formatTime, formatDate, formatNumber, localeOf } from "../lib/format";
import { metricStatus } from "../lib/series";

const WIDGETS = [
  { key: "CPU", field: "cpu_percent", hourly: "cpu_avg", icon: Cpu, color: "#3B82F6", unit: "%", base: 35, seed: 3 },
  { key: "RAM", field: "mem_percent", hourly: "mem_avg", icon: MemoryStick, color: "#8B5CF6", unit: "%", base: 55, seed: 7 },
  { key: "Disk", field: "disk_percent", hourly: "disk_avg", icon: HardDrive, color: "#F59E0B", unit: "%", base: 62, seed: 11 },
  { key: "Network", field: "net_mbps", hourly: "net_avg", icon: Network, color: "#10B981", unit: "Mb", base: 120, seed: 5 },
] as const;

export default function HostDetailPage() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const hostId = Number(id);
  const { user } = useAuth();
  const editable = canEdit(user);
  const live = useLiveStatus();
  const [mwindow, setMwindow] = useState<"24h" | "30d">("24h");
  const [hourly, setHourly] = useState<HostMetricHourly[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Fiche rafraîchie toutes les 30 s (pause onglet masqué). Un historique de check en
  // échec n'empêche pas l'affichage du reste (allSettled).
  const { data, error, loading, refresh } = usePolling(async () => {
    const [h, c, m, all] = await Promise.all([
      getHost(hostId),
      listChecks(hostId),
      getHostMetrics(hostId, 24).catch(() => ({ data: [] as HostMetric[] })),
      listHosts().catch(() => ({ data: [] as Host[] })),
    ]);
    const res = await Promise.allSettled(c.data.map((ch) => listResults(ch.id, 50)));
    const results = res
      .flatMap((r) => (r.status === "fulfilled" ? r.value.data : []))
      .sort((a, b) => +new Date(b.checked_at) - +new Date(a.checked_at));
    return { host: h.data, checks: c.data, metrics: m.data, results, hosts: all.data };
  }, 30000);

  useEffect(() => {
    // Distinguer « hôte inexistant ou non visible » (404) d'une panne réseau.
    if (error && !data) getHost(hostId).catch((e) => setNotFound(apiError(e).status === 404));
  }, [error, data, hostId]);

  // Rollups horaires chargés à la demande (vue 30 jours).
  useEffect(() => {
    if (mwindow === "30d" && hourly.length === 0) {
      getHostMetricsHourly(hostId, 30).then((r) => setHourly(r.data)).catch(() => {});
    }
  }, [mwindow, hostId, hourly.length]);

  const host = data?.host ?? null;
  const checks = data?.checks ?? [];
  const metrics = data?.metrics ?? [];
  const results = data?.results ?? [];
  const hasMetrics = metrics.length > 0;
  const lastMetric = hasMetrics ? metrics[metrics.length - 1] : null;
  const rawSeries = (field: string) =>
    metrics.map((m) => ({ label: formatTime(m.collected_at), value: Number((m as unknown as Record<string, unknown>)[field] ?? 0) }));
  const hourlySeries = (field: string) =>
    hourly.map((m) => ({
      label: new Date(m.bucket).toLocaleString(localeOf(lang), { day: "2-digit", month: "2-digit", hour: "2-digit" }),
      value: Number((m as unknown as Record<string, unknown>)[field] ?? 0),
    }));
  // Dernier relevé par disque (C:/D:/…) — uniquement si l'agent en a remonté.
  const latestDisks: Record<string, number> = lastMetric?.disks || {};

  // Hôte sans check = UNKNOWN (rien ne prouve qu'il fonctionne).
  const status = useMemo(() => (checks.length ? worstStatus(checks.map((c) => c.last_status ?? "UNKNOWN")) : "UNKNOWN"), [checks]);
  const checkName = useMemo(() => new Map(checks.map((c) => [c.id, c.name])), [checks]);
  const incidents = useMemo(() => prioritizeIncidents((live.incidents ?? []).filter((i) => i.host_id === hostId)), [live.incidents, hostId]);
  const parent = host?.parent_host_id ? data?.hosts.find((h) => h.id === host.parent_host_id) : undefined;

  if (loading && !data) return <Loading />;
  if (!host) {
    return notFound ? (
      <EmptyState icon={Server} title={t("hd.notFoundTitle")} message={t("hd.notFound")}
        action={<Link to="/hosts" className="btn-primary"><ArrowLeft className="h-4 w-4" aria-hidden /> {t("hosts.title")}</Link>} />
    ) : (
      <ErrorState message={error ?? t("common.loadError")} onRetry={refresh} />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        helpTopic="hosts"
        title={host.name}
        subtitle={[host.hostname_or_ip, host.environment, host.location].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {editable && (
              <>
                <Link to={`/checks?host=${host.id}`} className="btn-ghost"><ListChecks className="h-4 w-4" aria-hidden /> {t("hd.manageChecks")}</Link>
                <button type="button" className="btn-ghost" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden /> {t("common.edit")}</button>
              </>
            )}
          </div>
        }
      />

      {/* Informations générales */}
      <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Summary icon={Globe} label={t("hd.hostnameIp")} value={host.hostname_or_ip} mono />
        <Summary icon={Tag} label={t("hd.environment")} value={host.environment} />
        <Summary icon={CalendarClock} label={t("hosts.monitoredSince")} value={uptimeSince(host.created_at)} />
        <Summary icon={ListChecks} label={t("common.checks")} value={String(checks.length)} />
        {parent && <Summary icon={GitBranch} label={t("hosts.f.parentLabel")} value={parent.name} to={`/hosts/${parent.id}`} />}
        {lastMetric?.process_count != null && <Summary icon={Activity} label={t("hd.processes")} value={String(lastMetric.process_count)} />}
        {lastMetric?.load1 != null && <Summary icon={Gauge} label={t("hd.load1")} value={String(lastMetric.load1)} />}
        {lastMetric?.temperature != null && <Summary icon={Thermometer} label={t("hd.temperature")} value={`${lastMetric.temperature} °C`} />}
      </Card>

      {/* Incidents en cours sur cet hôte */}
      {incidents.length > 0 && (
        <Card>
          <SectionTitle title={`${t("hd.incidents")} (${incidents.length})`} icon={AlertTriangle}
            action={<Link to="/incidents" className="text-xs text-brand hover:underline">{t("dash.seeAll")}</Link>} />
          <div className="grid grid-cols-1 gap-3">
            {incidents.map((inc) => <AlertCard key={inc.alert_id} incident={inc} acknowledged={inc.acknowledged} />)}
          </div>
        </Card>
      )}

      {/* Mode de supervision (push / pull / SSH) */}
      <SupervisionCard host={host} />

      {/* Ressources — uniquement si l'hôte remonte de vraies métriques (agent) */}
      {hasMetrics ? (
        <>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-faint">{mwindow === "24h" ? t("hd.metrics24") : t("hd.metrics30")}</p>
              <div role="group" aria-label={t("dash.period")} className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
                {(["24h", "30d"] as const).map((w) => (
                  <button key={w} type="button" aria-pressed={mwindow === w} onClick={() => setMwindow(w)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${mwindow === w ? "bg-brand-soft text-white" : "text-ink-soft hover:text-ink"}`}>
                    {t(w === "24h" ? "dash.period.24h" : "dash.period.30d")}
                  </button>
                ))}
              </div>
            </div>
            <MotionGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {WIDGETS.map((w) => {
                const series = mwindow === "24h" ? rawSeries(w.field) : hourlySeries(w.hourly);
                const last = series.length ? series[series.length - 1].value : 0;
                const Icon = w.icon;
                const st = w.unit === "%" ? metricStatus(last) : "OK";
                const label = w.unit === "%" ? `${formatNumber(last)} %` : `${formatNumber(last, 1)} ${w.unit}`;
                return (
                  <Card key={w.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                        <Icon className="h-4 w-4" aria-hidden /> {t(`hd.w.${w.key}`)}
                      </span>
                      <StatusBadge status={st} label={label} size="xs" />
                    </div>
                    <MetricArea id={w.key} data={series} color={w.color} unit={w.unit} height={120} />
                  </Card>
                );
              })}
            </MotionGrid>
          </div>
          {Object.keys(latestDisks).length > 0 && (
            <Card>
              <SectionTitle title={`${t("hd.disks")} (${Object.keys(latestDisks).length})`} icon={HardDrive} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(latestDisks).map(([name, pct]) => <DiskBar key={name} name={name} pct={pct} />)}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="flex items-center gap-3 text-sm text-ink-soft">
          <Server className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden />
          <span>{t("hd.noMetrics")}</span>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Services surveillés */}
        <Card>
          <SectionTitle title={`${t("hd.services")} (${checks.length})`} icon={ListChecks} />
          {checks.length === 0 ? (
            <EmptyState icon={ListChecks} message={t("hd.noChecks")}
              action={editable ? <Link to={`/checks?host=${host.id}`} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("chk.new")}</Link> : undefined} />
          ) : (
            <ul className="space-y-2">
              {[...checks].sort((a, b) => SEVERITY_RANK[a.last_status ?? "UNKNOWN"] - SEVERITY_RANK[b.last_status ?? "UNKNOWN"]).map((c) => (
                <li key={c.id}>
                  <Link to={`/checks/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2 transition hover:border-ink-faint/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="block text-xs text-ink-faint">{metaFor(c.type, lang).label} · {c.interval_seconds} s</span>
                    </span>
                    <StatusBadge status={c.last_status} size="xs" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Historique des résultats : statut en texte + couleur */}
        <Card>
          <SectionTitle title={t("hd.timeline")} icon={History} />
          {results.length === 0 ? (
            <p className="text-sm text-ink-faint">{t("hd.noEvents")}</p>
          ) : (
            <ol className="relative max-h-[360px] space-y-3 overflow-y-auto border-l border-border pl-4">
              {results.slice(0, 40).map((r) => {
                const m = statusMeta(r.status);
                return (
                  <li key={r.id} className="relative">
                    <span className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-bg ${m.dot}`} aria-hidden />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">
                        {checkName.get(r.check_id) ?? `check #${r.check_id}`} <span className={`text-xs ${m.text}`}>· {m.label}</span>
                      </span>
                      <time dateTime={r.checked_at} className="shrink-0 text-xs text-ink-faint" title={formatDate(r.checked_at)}>{formatTime(r.checked_at)}</time>
                    </div>
                    {r.message && <p className="text-xs text-ink-soft">{r.message}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {editable && data && (
        <HostForm open={editOpen} host={host} hosts={data.hosts} environments={[...new Set(data.hosts.map((h) => h.environment))]}
          onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refresh(); }} />
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value, mono, to }: { icon: typeof Server; label: string; value: string; mono?: boolean; to?: string }) {
  const body = (
    <>
      <span className="rounded-lg bg-bg-soft p-2 text-ink-soft"><Icon className="h-4 w-4" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
        <span className={`block truncate text-sm font-medium ${to ? "text-brand" : "text-ink"} ${mono ? "font-mono" : ""}`}>{value}</span>
      </span>
    </>
  );
  return to ? <Link to={to} className="flex items-center gap-3 hover:opacity-80">{body}</Link> : <div className="flex items-center gap-3">{body}</div>;
}

function DiskBar({ name, pct }: { name: string; pct: number }) {
  const meta = statusMeta(metricStatus(pct));
  return (
    <div className="rounded-lg border border-border bg-bg-soft/50 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          <HardDrive className="h-4 w-4 text-ink-soft" /> {name}
        </span>
        <span className={meta.text}>{formatNumber(pct)} %</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: meta.color }} />
      </div>
    </div>
  );
}

const MODE_KEYS = ["agentless", "agent", "ssh"];

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard indispo */ }
  };
  return (
    <button onClick={copy} className="btn-ghost shrink-0 px-2 py-1 text-xs" title={t("hd.copy")}>
      {done ? <CheckIcon className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SupervisionCard({ host }: { host: Host }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const mode = host.monitoring_mode ?? "agentless";
  const modeKey = MODE_KEYS.includes(mode) ? mode : "agentless";
  const [enr, setEnr] = useState<HostEnrollment | null>(null);

  useEffect(() => {
    if (mode === "agent" && isAdmin(user)) {
      getHostEnrollment(host.id).then((r) => setEnr(r.data)).catch(() => {});
    } else {
      setEnr(null);
    }
  }, [host.id, mode, user]);

  const Icon = mode === "agent" ? Radio : mode === "ssh" ? Terminal : Server;

  return (
    <Card>
      <SectionTitle title={t("hd.superviseTitle")} icon={Icon} />
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{t(`hd.mode.${modeKey}`)}</span>
        <p className="text-xs text-ink-faint">{t(`hd.desc.${modeKey}`)}</p>
      </div>

      {mode === "agent" && (
        isAdmin(user) ? (
          enr ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-ink-soft">{t("hd.installCmd")}</p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 overflow-x-auto rounded-lg border border-border bg-bg-soft/60 p-3 text-xs text-ink">{enr.install_command}</pre>
                  <CopyButton text={enr.install_command} />
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  {t("hd.prereq")} <code>pip install psutil requests</code> {t("hd.andScript")} <code>agent_example.py</code> {t("hd.folder")} <code>scripts/</code>).
                  {enr.ingest_key_required ? t("hd.keyIncluded") : t("hd.noKey")}
                </p>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-ink-soft">{t("hd.systemd")}</summary>
                <div className="mt-2 flex items-start gap-2">
                  <pre className="flex-1 overflow-x-auto rounded-lg border border-border bg-bg-soft/60 p-3 text-[11px] text-ink">{enr.systemd_unit}</pre>
                  <CopyButton text={enr.systemd_unit} />
                </div>
              </details>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">{t("hd.loadingInstall")}</p>
          )
        ) : (
          <p className="text-xs text-ink-faint">{t("hd.adminOnly")}</p>
        )
      )}

      {mode === "ssh" && host.ssh_config && (
        <p className="text-xs text-ink-faint">
          {t("hd.connection")} <b className="text-ink-soft">{(host.ssh_config.user as string) || "?"}@{host.hostname_or_ip}:{String(host.ssh_config.port ?? 22)}</b>.
          {t("hd.inheritCreds")}
        </p>
      )}
    </Card>
  );
}

