import { useMemo } from "react";
import { Activity, Server } from "lucide-react";
import { listChecks, listHosts } from "../api/endpoints";
import { usePolling } from "../hooks/usePolling";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle, MotionGrid } from "../components/ui/Card";
import { HealthCard } from "../components/ui/HostCard";
import { StatusDonut } from "../components/charts/StatusDonut";
import { LiveEventFeed } from "../components/live/LiveEventFeed";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { buildHostViews, SEVERITY_RANK } from "../lib/fleet";
import { useLiveStatus } from "../lib/liveStatus";
import { useI18n } from "../lib/i18n";

/** Vue live : flux d'événements, matrice des hôtes (le plus grave d'abord), répartition des états.
 *  Inventaire rafraîchi toutes les 15 s (pause onglet masqué) ; résumé partagé avec le shell. */
export default function MonitoringPage() {
  const { t } = useI18n();
  const { summary } = useLiveStatus();
  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([listHosts(), listChecks()]).then(([h, c]) => ({ hosts: h.data, checks: c.data })),
    15000,
  );
  const views = useMemo(
    () => buildHostViews(data?.hosts ?? [], data?.checks ?? []).sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.name.localeCompare(b.name)),
    [data],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <PageHeader titleKey="page.monitoring.title" subtitleKey="page.monitoring.sub" helpTopic="dashboard" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><LiveEventFeed height={420} /></Card>
        <Card className="lg:col-span-2">
          <SectionTitle title={`${t("dash.sec.fleet")} — ${views.length} ${t("dash.hostsTotal").toLowerCase()}`} icon={Server} />
          {views.length === 0 ? (
            <EmptyState icon={Server} message={t("dash.noHostsHint")} />
          ) : (
            <MotionGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {views.map((h) => <HealthCard key={h.id} host={h} />)}
            </MotionGrid>
          )}
        </Card>
      </div>

      <Card className="lg:max-w-md">
        <SectionTitle title={t("dash.stateBreakdown")} icon={Activity} />
        {summary && <StatusDonut counts={summary.status_counts} />}
      </Card>
    </div>
  );
}
