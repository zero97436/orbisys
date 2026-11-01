import { useEffect, useMemo, useState } from "react";
import { Gauge, CalendarDays, CalendarRange, Timer, AlertTriangle, Wrench, FileDown } from "lucide-react";
import { getAvailability, getSlaReport, getMttrReport, downloadReportPdf, type AvailabilityReport, type SlaReport, type MttrReport } from "../api/endpoints";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle } from "../components/ui/Card";
import { MetricCard } from "../components/ui/MetricCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { AvailabilityChart } from "../components/charts/AvailabilityChart";
import { ErrorState, Loading } from "../components/States";
import { bucketsFromReport } from "../lib/series";
import { formatNumber, formatPercent } from "../lib/format";
import { getLang, useI18n } from "../lib/i18n";
import { useToast } from "../components/ui/Toast";
import { apiError, apiErrorMessage } from "../lib/apiError";
import { availabilityStatus, ACCENT_OF } from "../lib/status";

const DAY = 24 * 3600 * 1000;

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${formatNumber(sec / 3600, 1)} h`;
  return `${formatNumber(sec / 86400, 1)} ${getLang() === "en" ? "d" : "j"}`;
}

function slaAccent(av: number): "ok" | "warning" | "critical" {
  return av >= 99 ? "ok" : av >= 95 ? "warning" : "critical";
}

export default function ReportsPage() {
  const { t } = useI18n();
  const toast = useToast();
  // Disponibilité calculée par le serveur sur TOUS les checks et toute la fenêtre
  // (3 requêtes au lieu de 31, et plus d'échantillon limité aux 30 premiers checks).
  const [avail, setAvail] = useState<{ d1: AvailabilityReport; d7: AvailabilityReport; d30: AvailabilityReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [sla, setSla] = useState<SlaReport | null>(null);
  const [mttr, setMttr] = useState<MttrReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [proOnly, setProOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [d1, d7, d30] = await Promise.all([getAvailability(24, 24), getAvailability(24 * 7, 28), getAvailability(24 * 30, 30)]);
        setAvail({ d1: d1.data, d7: d7.data, d30: d30.data });
      } catch {
        setError(t("common.loadError"));
      }
      try {
        const [s, m] = await Promise.all([getSlaReport(30), getMttrReport(30)]);
        setSla(s.data);
        setMttr(m.data);
      } catch (e: unknown) {
        if (apiError(e).status === 403) setProOnly(true);
        else toast.error(apiErrorMessage(e, t("common.loadError")));
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct30 = avail?.d30.availability ?? null;
  const a24 = useMemo(() => (avail ? bucketsFromReport(avail.d1.buckets, DAY) : []), [avail]);
  const a7 = useMemo(() => (avail ? bucketsFromReport(avail.d7.buckets, 7 * DAY) : []), [avail]);
  const a30 = useMemo(() => (avail ? bucketsFromReport(avail.d30.buckets, 30 * DAY) : []), [avail]);

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await downloadReportPdf(30);
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = t("rep.pdfFile");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      if (apiError(e).status === 403) toast.info(t("rep.pdfProOnly"));
      else toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !avail) return <ErrorState message={error} onRetry={() => setReload((n) => n + 1)} />;

  return (
    <div className="space-y-6">
      <PageHeader
        titleKey="page.reports.title"
        subtitleKey="page.reports.sub"
        actions={
          <button onClick={exportPdf} disabled={exporting} className="btn-ghost">
            <FileDown className="h-4 w-4" /> {exporting ? t("rep.exporting") : t("rep.exportPdf")}
          </button>
        }
      />

      {proOnly && (
        <div className="card border-l-4 border-brand bg-brand/5 p-4 text-sm text-ink">
          ⭐ {t("rep.proBanner")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t("rep.globalAvail")} value={pct30 == null ? "—" : formatPercent(pct30, 2)} icon={Gauge} accent={ACCENT_OF[availabilityStatus(pct30)]} />
        <MetricCard label={t("rep.resultsAnalyzed")} value={formatNumber(avail?.d30.total ?? 0)} icon={CalendarDays} accent="info" />
        <MetricCard label={t("rep.window")} value={t("rep.days30")} icon={CalendarRange} accent="neutral" />
      </div>

      {/* MTTR & incidents (30 j) */}
      {mttr && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label={t("rep.mttr")} value={formatDuration(mttr.mttr_seconds)} icon={Timer} accent="info" />
          <MetricCard label={t("rep.longestIncident")} value={formatDuration(mttr.longest_seconds)} icon={Timer} accent="warning" />
          <MetricCard label={t("rep.incidents30")} value={mttr.incidents} icon={AlertTriangle} accent="neutral" />
          <MetricCard label={t("rep.activeResolved")} value={`${mttr.active} / ${mttr.resolved}`} icon={Wrench} accent={mttr.active ? "critical" : "ok"} />
        </div>
      )}

      {/* SLA par hôte (30 j) */}
      {sla && sla.hosts.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="p-5 pb-0">
            <SectionTitle title={`${t("rep.slaByHost")} ${formatPercent(sla.global_availability, 2)}`} icon={Gauge} />
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg-soft/50 text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr><th className="px-4 py-3">{t("ten.host")}</th><th className="px-4 py-3">{t("rep.availability")}</th><th className="px-4 py-3">{t("rep.samples")}</th><th className="px-4 py-3"><span className="sr-only">{t("list.col.status")}</span></th></tr>
            </thead>
            <tbody>
              {sla.hosts.map((h) => (
                <tr key={h.host_id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-ink">{h.host_name}</td>
                  <td className="px-4 py-2.5 font-medium tabular-nums">{formatPercent(h.availability, 2)}</td>
                  <td className="px-4 py-2.5 text-ink-faint">{h.samples}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={slaAccent(h.availability) === "ok" ? "OK" : slaAccent(h.availability) === "warning" ? "WARNING" : "CRITICAL"} size="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <SectionTitle title={t("rep.avail24")} icon={CalendarDays} />
        <AvailabilityChart data={a24} height={240} />
      </Card>
      <Card>
        <SectionTitle title={t("rep.avail7")} icon={CalendarDays} />
        <AvailabilityChart data={a7} height={240} />
      </Card>
      <Card>
        <SectionTitle title={t("rep.avail30")} icon={CalendarRange} />
        <AvailabilityChart data={a30} height={240} />
      </Card>

      <p className="text-xs text-ink-faint">
        {t("rep.note")}
      </p>
    </div>
  );
}
