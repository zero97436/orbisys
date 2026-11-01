import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Box, RefreshCw, Cpu, MemoryStick, AlertTriangle, CheckCircle2, Container } from "lucide-react";
import { listContainers, type DockerContainer } from "../api/endpoints";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, MotionGrid } from "../components/ui/Card";
import { MetricCard } from "../components/ui/MetricCard";
import { Loading } from "../components/States";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

function stateMeta(c: DockerContainer): { color: string; label: string } {
  if (c.state === "running" && c.health === "unhealthy") return { color: "rgb(var(--st-critical))", label: "ct.st.unhealthy" };
  if (c.state === "running") return { color: "rgb(var(--st-ok))", label: c.health === "healthy" ? "ct.st.healthy" : "ct.st.running" };
  if (c.state === "restarting") return { color: "rgb(var(--st-warning))", label: "ct.st.restarting" };
  if (c.state === "paused") return { color: "rgb(var(--st-warning))", label: "ct.st.paused" };
  return { color: "rgb(var(--st-critical))", label: c.state === "exited" ? "ct.st.stopped" : c.state };
}

export default function ContainersPage() {
  const { t: tr } = useI18n();
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    // Stats CPU/RAM (l'API Docker met ~2 s à les échantillonner).
    const { data } = await listContainers(true);
    setAvailable(data.available);
    setError(data.error);
    setContainers(data.containers);
  };
  useEffect(() => {
    // Affichage immédiat (états sans stats), puis hydratation avec CPU/RAM.
    listContainers(false)
      .then((r) => {
        setAvailable(r.data.available);
        setError(r.data.error);
        setContainers(r.data.containers);
      })
      .finally(() => setLoading(false));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load().finally(() => setRefreshing(false));
  };

  if (loading) return <Loading />;

  const running = containers.filter((c) => c.state === "running").length;
  const down = containers.filter((c) => ["exited", "dead"].includes(c.state)).length;
  const unhealthy = containers.filter((c) => c.health === "unhealthy" || c.state === "restarting").length;

  return (
    <div className="space-y-6">
      <PageHeader
        helpTopic="containers"
        titleKey="page.containers.title"
        subtitleKey="page.containers.sub"
        actions={
          <button onClick={refresh} className="btn-ghost" disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> {tr("cont.refresh")}
          </button>
        }
      />

      {!available ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Container className="h-12 w-12 text-ink-faint" />
            <p className="text-sm font-medium text-ink">{tr("cont.unreachable")}</p>
            <p className="max-w-md text-xs text-ink-faint">{error}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label={tr("cont.containers")} value={containers.length} icon={Box} accent="info" />
            <MetricCard label={tr("cont.running")} value={running} icon={CheckCircle2} accent="ok" />
            <MetricCard label={tr("cont.stoppedN")} value={down} icon={AlertTriangle} accent={down ? "critical" : "neutral"} />
            <MetricCard label={tr("cont.unstable")} value={unhealthy} icon={AlertTriangle} accent={unhealthy ? "warning" : "neutral"} />
          </div>

          <MotionGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {containers.map((c) => {
              const m = stateMeta(c);
              return (
                <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <div className="card border-l-4 p-4" style={{ borderColor: m.color }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{c.name}</p>
                        <p className="truncate text-xs text-ink-faint">{c.image}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${m.color} 9%, transparent)`, color: m.color }}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", c.state !== "running" && "animate-pulse")} style={{ background: m.color }} />
                        {m.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">{c.status}</p>
                    {c.state === "running" && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Res icon={Cpu} label="CPU" value={c.cpu_percent != null ? `${c.cpu_percent}%` : "—"} pct={c.cpu_percent} />
                        <Res icon={MemoryStick} label="RAM" value={c.mem_usage_mb != null ? `${c.mem_usage_mb} Mo` : "—"} pct={c.mem_percent} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </MotionGrid>

          <p className="text-xs text-ink-faint">{tr("cont.note")}</p>
        </>
      )}
    </div>
  );
}

function Res({ icon: Icon, label, value, pct }: { icon: typeof Cpu; label: string; value: string; pct: number | null }) {
  const color = pct == null ? "rgb(var(--st-unknown))" : pct >= 90 ? "rgb(var(--st-critical))" : pct >= 70 ? "rgb(var(--st-warning))" : "rgb(var(--st-info))";
  return (
    <div className="rounded-lg bg-bg-soft/60 p-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-faint">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
      </div>
      {pct != null && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}
