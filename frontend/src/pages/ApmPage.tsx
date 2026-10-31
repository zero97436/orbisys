import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Gauge, Timer, Boxes, RefreshCw } from "lucide-react";
import { listApmApps, getApmSeries, type ApmApp, type ApmPoint } from "../api/endpoints";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle, MotionGrid } from "../components/ui/Card";
import { MetricArea } from "../components/charts/MetricArea";
import { EmptyState, Loading } from "../components/States";
import { localeOf, timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import { useI18n, translate, type Lang } from "../lib/i18n";

function health(app: ApmApp, lang: Lang): { color: string; label: string } {
  if (app.requests === 0) return { color: "rgb(var(--st-unknown))", label: translate(lang, "apm.silent") };
  if (app.error_rate >= 10) return { color: "rgb(var(--st-critical))", label: translate(lang, "apm.degraded") };
  if (app.error_rate >= 5 || (app.latency_ms ?? 0) >= 1000) return { color: "rgb(var(--st-warning))", label: translate(lang, "apm.watch") };
  return { color: "rgb(var(--st-ok))", label: translate(lang, "apm.healthy") };
}

export default function ApmPage() {
  const { t, lang } = useI18n();
  const [apps, setApps] = useState<ApmApp[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [series, setSeries] = useState<ApmPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await listApmApps(15);
    setApps(data);
    if (!selected && data.length) setSelected(data[0].app_name);
  };
  useEffect(() => {
    load().finally(() => setLoading(false));
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    getApmSeries(selected, 24, 48).then((r) => setSeries(r.data));
  }, [selected, apps]);

  const refresh = async () => {
    setRefreshing(true);
    await load().finally(() => setRefreshing(false));
  };

  const chart = useMemo(() => {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString(localeOf(), { hour: "2-digit", minute: "2-digit" });
    return {
      rpm: series.map((p) => ({ label: fmt(p.t), value: p.rpm })),
      err: series.map((p) => ({ label: fmt(p.t), value: p.error_rate })),
      lat: series.map((p) => ({ label: fmt(p.t), value: p.latency_ms ?? 0 })),
    };
  }, [series]);

  if (loading) return <Loading />;

  const sel = apps.find((a) => a.app_name === selected);

  return (
    <div className="space-y-6">
      <PageHeader
        helpTopic="apm"
        titleKey="page.apm.title"
        subtitleKey="page.apm.sub"
        actions={
          <button onClick={refresh} className="btn-ghost" disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden /> {t("common.refresh")}
          </button>
        }
      />

      {apps.length === 0 ? (
        <Card>
          <EmptyState message={t("apm.empty")} />
          <div className="mx-auto max-w-2xl pb-4 text-xs text-ink-faint">
            <p className="mb-2">{t("apm.sendHint")}</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-bg-soft p-3">
{`POST /api/apm/ingest
{"app_name": "mon-erp", "requests": 420, "errors": 3, "latency_ms": 185}`}
            </pre>
            <p className="mt-2">{t("apm.selfHint")}</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Cartes applications */}
          <MotionGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => {
              const h = health(a, lang);
              const active = a.app_name === selected;
              return (
                <motion.button
                  key={a.app_name}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  onClick={() => setSelected(a.app_name)}
                  className={cn(
                    "card p-4 text-left transition-all hover:-translate-y-0.5",
                    active && "ring-2 ring-brand",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Boxes className="h-4 w-4 shrink-0 text-ink-faint" />
                      <p className="truncate font-semibold text-ink">{a.app_name}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${h.color} 9%, transparent)`, color: h.color }}>
                      {h.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Kpi label={t("apm.reqMin")} value={a.rpm} color="rgb(var(--st-info))" />
                    <Kpi label={t("apm.errors")} value={`${a.error_rate}%`} color={a.error_rate >= 5 ? "rgb(var(--st-critical))" : "rgb(var(--st-ok))"} />
                    <Kpi label={t("apm.latency")} value={a.latency_ms != null ? `${a.latency_ms} ms` : "—"} color={(a.latency_ms ?? 0) >= 1000 ? "rgb(var(--st-warning))" : "rgb(var(--st-maintenance))"} />
                  </div>
                  {a.last_seen && (
                    <p className="mt-2 text-right text-[11px] text-ink-faint">{t("apm.seen")} {timeAgo(a.last_seen)}</p>
                  )}
                </motion.button>
              );
            })}
          </MotionGrid>

          {/* Détail : séries 24 h */}
          {sel && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <SectionTitle title={`${t("apm.throughput")} — ${sel.app_name}`} icon={Activity} />
                <MetricArea id="apm-rpm" data={chart.rpm} color="#3B82F6" unit="" height={190} />
              </Card>
              <Card>
                <SectionTitle title={t("apm.errorRate")} icon={AlertTriangle} />
                <MetricArea id="apm-err" data={chart.err} color="#EF4444" unit="%" height={190} domain={[0, 100]} />
              </Card>
              <Card>
                <SectionTitle title={t("apm.latencyMs")} icon={Timer} />
                <MetricArea id="apm-lat" data={chart.lat} color="#8B5CF6" unit="" height={190} />
              </Card>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <Gauge className="h-3.5 w-3.5" />
            {t("apm.alertHint1")} <code className="rounded bg-bg-soft px-1">apm</code> {t("apm.alertHint2")}{" "}
            <code className="rounded bg-bg-soft px-1">{'{"app": "…", "metric": "error_rate"}'}</code> {t("apm.alertHint3")}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg bg-bg-soft/60 py-2">
      <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  );
}
