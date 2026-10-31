import { useEffect, useMemo, useState } from "react";
import { Gauge, CalendarDays, CalendarRange, Timer, AlertTriangle, Wrench, FileDown } from "lucide-react";
import { listChecks, listResults, getSlaReport, getMttrReport, downloadReportPdf, type SlaReport, type MttrReport } from "../api/endpoints";
import type { Check, CheckResult } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle } from "../components/ui/Card";
import { MetricCard } from "../components/ui/MetricCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { AvailabilityChart } from "../components/charts/AvailabilityChart";
import { Loading } from "../components/States";
import { availabilityBuckets, availabilityRatio } from "../lib/series";
import { formatPercent } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useToast } from "../components/ui/Toast";
import { apiError, apiErrorMessage } from "../lib/apiError";
import { availabilityStatus, ACCENT_OF } from "../lib/status";

const DAY = 24 * 3600 * 1000;

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} j`;
}

function slaAccent(av: number): "ok" | "warning" | "critical" {
  return av >= 99 ? "ok" : av >= 95 ? "warning" : "critical";
}

export default function ReportsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [sla, setSla] = useState<SlaReport | null>(null);
  const [mttr, setMttr] = useState<MttrReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [proOnly, setProOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: checks } = await listChecks();
      const res = await Promise.all(checks.slice(0, 30).map((c: Check) => listResults(c.id, 500)));
      setResults(res.flatMap((r) => r.data));
      try {
        const [s, m] = await Promise.all([getSlaReport(30), getMttrReport(30)]);
        setSla(s.data);
        setMttr(m.data);
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 403) setProOnly(true);
      }
      setLoading(false);
    })();
  }, []);

  const avail = useMemo(() => availabilityRatio(results), [results]);
  const a24 = useMemo(() => availabilityBuckets(results, DAY, 24), [results]);
  const a7 = useMemo(() => availabilityBuckets(results, 7 * DAY, 28), [results]);
  const a30 = useMemo(() => availabilityBuckets(results, 30 * DAY, 30), [results]);

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await downloadReportPdf(30);
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rapport-supervision-30j.pdf";
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
        <MetricCard label={t("rep.globalAvail")} value={avail == null ? "—" : formatPercent(avail, 2)} icon={Gauge} accent={ACCENT_OF[availabilityStatus(avail)]} />
        <MetricCard label={t("rep.resultsAnalyzed")} value={results.length} icon={CalendarDays} accent="info" />
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
              <tr><th className="px-4 py-3">{t("ten.host")}</th><th className="px-4 py-3">{t("rep.availability")}</th><th className="px-4 py-3">{t("rep.samples")}</th><th className="px-4 py-3"></th></tr>
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
