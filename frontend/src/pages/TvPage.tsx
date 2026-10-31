import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Maximize, Minimize, RotateCw, WifiOff, X } from "lucide-react";
import { BrandLogo } from "../components/ui/BrandLogo";
import { useBranding } from "../lib/branding";
import { getIncidents, getSummary, listChecks, listHosts } from "../api/endpoints";
import { buildHostViews, overallStatus, prioritizeIncidents, SEVERITY_RANK } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { usePolling } from "../hooks/usePolling";
import { useNow } from "../hooks/useNow";
import { localeOf, uptimeSince } from "../lib/format";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

const MAX_INCIDENTS = 6;
const MAX_HOSTS = 12;

/** Vue mur d'écrans : lisible de loin, sans interaction. En cas de perte de connexion,
 *  les dernières données restent affichées mais un bandeau l'indique clairement. */
export default function TvPage() {
  const { t, lang } = useI18n();
  const { branding } = useBranding();
  const now = useNow(1000);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([getSummary(), getIncidents(), listHosts(), listChecks()])
      .then(([s, i, h, c]) => ({ summary: s.data, incidents: i.data, hosts: h.data, checks: c.data })),
    15000,
  );
  useEffect(() => { if (data && !error) setLastOk(Date.now()); }, [data, error]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Hôtes : les plus graves d'abord (un hôte OK n'apparaît que s'il reste de la place).
  const views = useMemo(
    () => buildHostViews(data?.hosts ?? [], data?.checks ?? []).sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.name.localeCompare(b.name)),
    [data],
  );
  const locale = localeOf(lang);
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (!data) {
    return (
      <div className="theme-dark-vars flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-ink-soft">
        {loading ? (
          <p className="text-2xl">{t("common.loading")}</p>
        ) : (
          <>
            <WifiOff className="h-12 w-12 text-status-warning" aria-hidden />
            <p className="text-2xl">{t("tv.unreachable")}</p>
            <button type="button" className="btn-ghost" onClick={refresh}><RotateCw className="h-4 w-4" aria-hidden /> {t("common.retry")}</button>
            <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink">{t("tv.exit")}</Link>
          </>
        )}
      </div>
    );
  }

  const { summary, incidents: rawIncidents } = data;
  const c = summary.status_counts;
  const overall = overallStatus(c);
  const meta = statusMeta(overall);
  const incidents = prioritizeIncidents(rawIncidents);
  const stale = !!error;

  return (
    <div className="theme-dark-vars flex min-h-screen flex-col gap-6 bg-black p-6 text-ink lg:p-8">
      {/* En-tête : marque, horloge, actions */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-ink-soft">
          <BrandLogo className="h-10 w-10 shrink-0" />
          <span className="text-2xl font-bold tracking-tight">{branding.display_name}</span>
        </div>
        <time dateTime={now.toISOString()} className="text-5xl font-bold tabular-nums tracking-tight lg:text-6xl">
          {now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </time>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleFullscreen} className="rounded-lg border border-border p-2 text-ink-faint hover:text-ink"
            aria-label={fullscreen ? t("tv.exitFullscreen") : t("tv.fullscreen")} title={fullscreen ? t("tv.exitFullscreen") : t("tv.fullscreen")}>
            {fullscreen ? <Minimize className="h-5 w-5" aria-hidden /> : <Maximize className="h-5 w-5" aria-hidden />}
          </button>
          <Link to="/dashboard" className="rounded-lg border border-border p-2 text-ink-faint hover:text-ink" aria-label={t("tv.exit")} title={t("tv.exit")}>
            <X className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Perte de connexion : impossible à manquer, données marquées comme anciennes */}
      {stale && (
        <div role="alert" className="flex items-center gap-4 rounded-2xl border-2 border-status-warning bg-status-warning/15 px-6 py-4 text-status-warning">
          <WifiOff className="h-8 w-8 shrink-0" aria-hidden />
          <p className="text-2xl font-bold">
            {t("tv.stale").replace("{time}", lastOk ? fmtTime(lastOk) : "—")}
          </p>
        </div>
      )}

      {/* Bannière d'état */}
      <section className={cn("flex flex-wrap items-center justify-between gap-6 rounded-3xl border-2 px-8 py-6 lg:px-10 lg:py-8", stale && "opacity-60")}
        style={{ borderColor: meta.color, background: `linear-gradient(135deg, ${meta.color}26, ${meta.color}08)` }}>
        <div className="flex items-center gap-5">
          <meta.icon className="h-14 w-14 shrink-0" style={{ color: meta.color }} aria-hidden />
          <p className="text-4xl font-black lg:text-5xl" style={{ color: meta.color }}>
            {overall === "OK" ? t("tv.allOk")
              : overall === "CRITICAL" ? `${c.CRITICAL} ${t("tv.critical")}`
              : overall === "WARNING" ? `${c.WARNING} ${t("tv.warning")}`
              : t("tv.waiting")}
          </p>
        </div>
        <dl className="flex gap-10 text-center">
          <TvStat label={t("tv.hosts")} value={summary.hosts_total} />
          <TvStat label={t("common.checks")} value={summary.checks_total} />
          <TvStat label={t("dash.incidents")} value={incidents.length} tone={incidents.length ? "text-status-critical" : "text-status-ok"} />
        </dl>
      </section>

      <div className={cn("grid flex-1 grid-cols-1 gap-6 xl:grid-cols-2", stale && "opacity-60")}>
        {/* Incidents, les plus urgents d'abord */}
        <section className="space-y-3" aria-label={t("tv.activeIncidents")}>
          <h2 className="text-base font-semibold uppercase tracking-widest text-ink-soft">{t("tv.activeIncidents")}</h2>
          {incidents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-border">
              <CheckCircle2 className="h-14 w-14 text-status-ok" aria-hidden />
              <p className="text-2xl font-semibold text-status-ok">{t("tv.noIncident")}</p>
            </div>
          ) : (
            <>
              {incidents.slice(0, MAX_INCIDENTS).map((inc) => {
                const m = statusMeta(inc.status);
                return (
                  <div key={inc.alert_id} className="flex items-center gap-4 rounded-2xl border-l-8 bg-bg-soft/40 px-5 py-4" style={{ borderColor: m.color }}>
                    <m.icon className="h-7 w-7 shrink-0" style={{ color: m.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-2xl font-semibold">
                        {inc.host_name} <span className="text-ink-faint">/</span> {inc.check_name}
                      </p>
                      {inc.message && <p className="truncate text-base text-ink-soft">{inc.message}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold" style={{ color: m.color }}>{m.label}</p>
                      <p className="text-base text-ink-soft">{t("incd.for")} {uptimeSince(inc.since)}</p>
                      {inc.acknowledged && <p className="text-sm text-status-info">{t("alert.acked")}</p>}
                    </div>
                  </div>
                );
              })}
              {incidents.length > MAX_INCIDENTS && (
                <p className="text-center text-lg text-ink-soft">{t("tv.more").replace("{n}", String(incidents.length - MAX_INCIDENTS))}</p>
              )}
            </>
          )}
        </section>

        {/* Hôtes */}
        <section className="space-y-3" aria-label={t("tv.fleet")}>
          <h2 className="text-base font-semibold uppercase tracking-widest text-ink-soft">{t("tv.fleet")} — {views.length} {t("tv.hostsWord")}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {views.slice(0, MAX_HOSTS).map((v) => {
              const m = statusMeta(v.status);
              return (
                <div key={v.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: `${m.color}55`, background: `${m.color}12` }}>
                  <div className="flex items-center gap-2">
                    <m.icon className="h-5 w-5 shrink-0" style={{ color: m.color }} aria-hidden />
                    <p className="truncate text-lg font-semibold">{v.name}</p>
                  </div>
                  <p className="mt-1 text-base" style={{ color: m.color }}>
                    {m.label} · {v.checksCount} {t("tv.checksN")}
                  </p>
                </div>
              );
            })}
          </div>
          {views.length > MAX_HOSTS && (
            <p className="text-center text-lg text-ink-soft">{t("tv.moreHosts").replace("{n}", String(views.length - MAX_HOSTS))}</p>
          )}
        </section>
      </div>

      <footer className="flex items-center justify-between text-sm text-ink-faint">
        <span>{t("tv.footer")}</span>
        <span>{t("live.updated")} {lastOk ? fmtTime(lastOk) : "—"}</span>
      </footer>
    </div>
  );
}

function TvStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dd className={cn("text-5xl font-bold tabular-nums", tone)}>{value}</dd>
      <dt className="text-sm uppercase tracking-widest text-ink-soft">{label}</dt>
    </div>
  );
}
