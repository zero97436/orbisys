import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, Timer, Gauge, History } from "lucide-react";
import { getAvailability, getCheck, listResults, runCheck, type AvailabilityReport } from "../api/endpoints";
import type { Check, CheckResult } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { MetricCard } from "../components/ui/MetricCard";
import { AvailabilityChart } from "../components/charts/AvailabilityChart";
import { ResponseTimeChart } from "../components/charts/ResponseTimeChart";
import { PerfdataChart } from "../components/charts/PerfdataChart";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { bucketsFromReport, responseTimeSeries } from "../lib/series";
import { formatDate, formatMs, formatPercent, localeOf } from "../lib/format";
import { metaFor } from "../lib/checkMeta";
import { apiError, apiErrorMessage } from "../lib/apiError";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { availabilityStatus, ACCENT_OF } from "../lib/status";

const DAY = 24 * 3600 * 1000;

export default function CheckDetailPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { id } = useParams();
  const checkId = Number(id);
  const [check, setCheck] = useState<Check | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [perfKey, setPerfKey] = useState<string | null>(null);
  const { user } = useAuth();
  const editable = canEdit(user);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE = 300;

  // Disponibilité 24 h calculée par le serveur sur TOUS les résultats du check.
  const [avail24, setAvail24] = useState<AvailabilityReport | null>(null);

  const load = () => {
    Promise.all([getCheck(checkId), listResults(checkId, PAGE)])
      .then(([c, r]) => {
        setCheck(c.data);
        setResults(r.data);
        setHasMore(r.data.length === PAGE);
        getAvailability(24, 24, checkId).then((a) => setAvail24(a.data)).catch(() => setAvail24(null));
      })
      // 404 = check inexistant ou non visible ; sinon panne réseau / serveur.
      .catch((e) => setError(apiError(e).status === 404 ? t("cd.notFound") : t("common.loadError")))
      .finally(() => setLoading(false));
  };
  useEffect(load, [checkId]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await listResults(checkId, PAGE, results.length);
      setResults((r) => [...r, ...data]);
      setHasMore(data.length === PAGE);
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.loadError")));
    } finally {
      setLoadingMore(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const { data: r } = await runCheck(checkId);
      const msg = `${t(`status.${r.status}`)}${r.message ? ` — ${r.message}` : ""}`;
      if (r.status === "OK") toast.success(msg); else toast.info(msg);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setRunning(false);
    }
  };

  const avail = avail24?.availability ?? null;
  const avail24h = useMemo(() => (avail24 ? bucketsFromReport(avail24.buckets, DAY) : []), [avail24]);
  const rt = useMemo(() => responseTimeSeries(results), [results]);
  const avgMs = useMemo(
    () => (rt.length ? Math.round(rt.reduce((a, r) => a + r.ms, 0) / rt.length) : null),
    [rt],
  );

  // Clés perfdata numériques disponibles dans l'historique.
  const perfKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of results) {
      for (const [k, v] of Object.entries(r.perfdata ?? {})) {
        if (typeof v === "number") keys.add(k);
      }
    }
    return [...keys];
  }, [results]);

  const activePerfKey = perfKey && perfKeys.includes(perfKey) ? perfKey : perfKeys[0] ?? null;

  const perfSeries = useMemo(() => {
    if (!activePerfKey) return [];
    return [...results]
      .filter((r) => typeof r.perfdata?.[activePerfKey] === "number")
      .sort((a, b) => +new Date(a.checked_at) - +new Date(b.checked_at))
      .map((r) => ({
        label: new Date(r.checked_at).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" }),
        value: r.perfdata[activePerfKey] as number,
      }));
  }, [results, activePerfKey]);

  if (loading) return <Loading />;
  if (error || !check) return <ErrorState message={error ?? t("common.loadError")} onRetry={() => { setError(null); setLoading(true); load(); }} />;

  return (
    <div className="space-y-6">
      <Link to={`/hosts/${check.host_id}`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("cd.backToHost")}
      </Link>
      <PageHeader
        helpTopic="checks"
        title={check.name}
        subtitle={`${metaFor(check.type, lang).label} · ${t("cd.interval")} ${check.interval_seconds} s · ${t("cd.timeout")} ${check.timeout_seconds} s`}
        actions={
          editable && (
            <button onClick={run} disabled={running} className="btn-primary">
              <Play className="h-4 w-4" /> {running ? t("cd.running") : t("cd.run")}
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={t("cd.currentStatus")} value={check.last_status ?? "UNKNOWN"} icon={Gauge}
          accent={check.last_status === "OK" ? "ok" : check.last_status === "WARNING" ? "warning" : check.last_status === "CRITICAL" ? "critical" : "unknown"} />
        <MetricCard label={t("cd.availCard")} value={avail == null ? "—" : formatPercent(avail, 1)} icon={Gauge} accent={ACCENT_OF[availabilityStatus(avail)]} />
        <MetricCard label={t("cd.avgTime")} value={formatMs(avgMs)} icon={Timer} accent="info" />
        <MetricCard label={t("cd.results")} value={results.length} icon={History} accent="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t("cd.avail24")} icon={Gauge} />
          <AvailabilityChart data={avail24h} />
        </Card>
        <Card>
          <SectionTitle title={t("cd.responseTime")} icon={Timer} />
          {rt.length ? <ResponseTimeChart data={rt} /> : (
            <p className="flex h-[220px] items-center justify-center text-sm text-ink-faint">{t("cd.noDuration")}</p>
          )}
        </Card>
      </div>

      {perfKeys.length > 0 && (
        <Card>
          <SectionTitle
            title={t("cd.perfdata")}
            icon={Gauge}
            action={
              <select
                value={activePerfKey ?? ""}
                onChange={(e) => setPerfKey(e.target.value)}
                className="input py-1.5 text-xs"
              >
                {perfKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            }
          />
          {activePerfKey && <PerfdataChart data={perfSeries} name={activePerfKey} />}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="p-5 pb-0"><SectionTitle title={t("cd.history")} icon={History} /></div>
        {results.length === 0 ? (
          <div className="p-5"><EmptyState message={t("cd.noResult")} /></div>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg-soft/50 text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3">{t("cd.date")}</th>
                <th className="px-4 py-3">{t("cd.status")}</th>
                <th className="px-4 py-3">{t("cd.value")}</th>
                <th className="px-4 py-3">{t("cd.message")}</th>
                <th className="px-4 py-3">{t("cd.duration")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-ink-faint">{formatDate(r.checked_at)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} size="xs" /></td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.value ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.message}</td>
                  <td className="px-4 py-2.5 text-ink-faint">{formatMs(r.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm text-ink-soft hover:text-ink">
              {loadingMore ? t("cd.loadingMore") : t("cd.loadMore")}
            </button>
          )}
          </>
        )}
      </Card>
    </div>
  );
}
