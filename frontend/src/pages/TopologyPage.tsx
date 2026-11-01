import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactFlow, {
  Background, Controls, Handle, MarkerType, MiniMap, Position,
  type Edge, type Node, type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { GitBranch, Server } from "lucide-react";
import { listChecks, listHosts } from "../api/endpoints";
import type { CheckStatus } from "../types";
import type { HostView } from "../components/ui/HostCard";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { FilterChips, SearchInput } from "../components/ui/ListControls";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { usePolling } from "../hooks/usePolling";
import { buildHostViews, hostBuckets, SEVERITY_RANK } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

type StatusFilter = CheckStatus | "ALL";
const W = 220, H = 64, GAP_X = 24, GAP_Y = 18, LAYER_GAP = 44, PAD = 20, HEADER = 34, GROUP_GAP = 36;

/** Nœud hôte : statut en icône + texte (pas seulement la couleur), cliquable. */
const HostNode = memo(({ data }: NodeProps<{ view: HostView; dim: boolean; label: string }>) => {
  const m = statusMeta(data.view.status);
  return (
    <div className={cn("flex h-full w-full items-center gap-2 rounded-lg border bg-card px-3 text-left shadow-card transition-opacity",
      data.dim && "opacity-25")}
      style={{ borderColor: m.color, borderLeftWidth: 4 }} title={`${data.view.name} — ${data.label}`}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <m.icon className="h-4 w-4 shrink-0" style={{ color: m.color }} aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-ink">{data.view.name}</span>
        <span className="block truncate font-mono text-[11px] text-ink-faint">{data.view.hostname_or_ip}</span>
        <span className="block text-[10px] font-medium" style={{ color: m.color }}>{data.label}</span>
      </span>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </div>
  );
});
HostNode.displayName = "HostNode";

/** Cadre d'environnement : simple regroupement visuel, pas un lien réseau. */
const EnvGroup = memo(({ data }: NodeProps<{ env: string; count: number; worst: CheckStatus }>) => {
  const m = statusMeta(data.worst);
  return (
    <div className="h-full w-full rounded-2xl border border-dashed border-border bg-bg-soft/40">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} aria-hidden /> {data.env} · {data.count}
      </div>
    </div>
  );
});
EnvGroup.displayName = "EnvGroup";

const NODE_TYPES = { host: HostNode, env: EnvGroup };

/** Profondeur dans l'arbre de dépendances (parents d'abord dans chaque groupe). */
function depthOf(v: HostView, byId: Map<number, HostView>): number {
  let d = 0;
  let cur = v.parent_host_id ? byId.get(v.parent_host_id) : undefined;
  const seen = new Set<number>();
  while (cur && !seen.has(cur.id) && d < 20) { seen.add(cur.id); d++; cur = cur.parent_host_id ? byId.get(cur.parent_host_id) : undefined; }
  return d;
}

export default function TopologyPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([listHosts(), listChecks()]).then(([h, c]) => ({ hosts: h.data, checks: c.data })),
    30000,
  );
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [env, setEnv] = useState("");
  const [q, setQ] = useState("");
  const [onlyDeps, setOnlyDeps] = useState(false);

  const views = useMemo(() => buildHostViews(data?.hosts ?? [], data?.checks ?? []), [data]);
  const counts = useMemo(() => hostBuckets(views), [views]);
  const envs = useMemo(() => [...new Set(views.map((v) => v.environment))].sort(), [views]);
  const depCount = views.filter((v) => v.parent_host_id).length;

  const { nodes, edges, matches } = useMemo(() => {
    const byId = new Map(views.map((v) => [v.id, v]));
    const involved = new Set<number>();
    for (const v of views) if (v.parent_host_id && byId.has(v.parent_host_id)) { involved.add(v.id); involved.add(v.parent_host_id); }
    const visible = views.filter((v) =>
      (status === "ALL" || v.status === status) && (!env || v.environment === env) && (!onlyDeps || involved.has(v.id)));
    const needle = q.trim().toLowerCase();
    const isMatch = (v: HostView) => !needle || `${v.name} ${v.hostname_or_ip}`.toLowerCase().includes(needle);

    // Disposition en couches : dans chaque environnement, les hôtes sans parent en haut,
    // leurs enfants sur la couche suivante, rangés sous leur parent (lecture verticale).
    const nodes: Node[] = [];
    let y = 0;
    for (const e of envs) {
      const inEnv = visible.filter((v) => v.environment === e);
      if (!inEnv.length) continue;
      const layers = new Map<number, HostView[]>();
      for (const v of inEnv) {
        const d = depthOf(v, byId);
        layers.set(d, [...(layers.get(d) ?? []), v]);
      }
      const order = new Map<number, number>();
      const placed: { v: HostView; x: number; y: number }[] = [];
      let cols = 1;
      let cursor = HEADER;
      for (const d of [...layers.keys()].sort((a, b) => a - b)) {
        const layer = layers.get(d)!.sort((a, b) =>
          (order.get(a.parent_host_id ?? -1) ?? -1) - (order.get(b.parent_host_id ?? -1) ?? -1) ||
          SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.name.localeCompare(b.name));
        const lc = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(layer.length * 1.6))));
        cols = Math.max(cols, lc);
        layer.forEach((v, i) => {
          order.set(v.id, placed.length);
          placed.push({ v, x: PAD + (i % lc) * (W + GAP_X), y: cursor + Math.floor(i / lc) * (H + GAP_Y) });
        });
        cursor += Math.ceil(layer.length / lc) * (H + GAP_Y) - GAP_Y + LAYER_GAP;
      }
      const gw = PAD * 2 + cols * W + (cols - 1) * GAP_X;
      const gh = cursor - LAYER_GAP + PAD;
      const worst = inEnv.reduce<CheckStatus>((acc, v) => (SEVERITY_RANK[v.status] < SEVERITY_RANK[acc] ? v.status : acc), "OK");
      nodes.push({ id: `env-${e}`, type: "env", position: { x: 0, y }, data: { env: e, count: inEnv.length, worst },
        style: { width: gw, height: gh }, selectable: false, draggable: false, zIndex: -1 });
      for (const { v, x, y: hy } of placed) {
        nodes.push({
          id: `host-${v.id}`, type: "host", parentNode: `env-${e}`, extent: "parent",
          position: { x, y: hy },
          data: { view: v, dim: !isMatch(v), label: t(`status.${v.status}`) },
          style: { width: W, height: H },
        });
      }
      y += gh + GROUP_GAP;
    }
    const shown = new Set(visible.map((v) => v.id));
    // Seules relations dessinées : les dépendances déclarées (hôte parent → hôte enfant).
    const edges: Edge[] = visible
      .filter((v) => v.parent_host_id && shown.has(v.parent_host_id))
      .map((v) => {
        const parent = byId.get(v.parent_host_id!)!;
        const down = parent.status === "CRITICAL";
        return {
          id: `dep-${parent.id}-${v.id}`, source: `host-${parent.id}`, target: `host-${v.id}`,
          animated: down, type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: down ? "rgb(var(--st-critical))" : "rgb(var(--violet))" },
          style: { stroke: down ? "rgb(var(--st-critical))" : "rgb(var(--violet))", strokeWidth: 1.6, strokeDasharray: "6 4" },
        };
      });
    return { nodes, edges, matches: needle ? visible.filter(isMatch).length : null };
  }, [views, envs, status, env, q, onlyDeps, t]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-5">
      <PageHeader titleKey="page.topology.title" subtitleKey="page.topology.sub" />

      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("topo.searchPh")} className="min-w-[220px] flex-1" />
          <label className="sr-only" htmlFor="topo-env">{t("hosts.f.environment")}</label>
          <select id="topo-env" className="input" value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="">{t("hosts.allEnvs")}</option>
            {envs.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4" checked={onlyDeps} onChange={(e) => setOnlyDeps(e.target.checked)} />
            {t("topo.onlyDeps")} ({depCount})
          </label>
        </div>
        <FilterChips<StatusFilter>
          label={t("list.statusFilter")}
          value={status}
          onChange={setStatus}
          options={[
            { v: "ALL", label: t("common.all"), count: views.length },
            ...(["CRITICAL", "WARNING", "UNKNOWN", "OK"] as const).map((s) => ({ v: s, label: t(`status.${s}`), count: counts[s], tone: statusMeta(s).dot })),
          ]}
        />
        {matches !== null && <p className="text-xs text-ink-faint" role="status">{t("topo.matches").replace("{n}", String(matches))}</p>}
      </div>

      {views.length === 0 ? (
        <EmptyState icon={Server} message={t("dash.noHostsHint")} />
      ) : nodes.length === 0 ? (
        <EmptyState message={t("list.noMatch")} />
      ) : (
        <Card className="p-0">
          <div className="h-[calc(100vh-330px)] min-h-[420px] overflow-hidden rounded-xl">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              fitView
              minZoom={0.1}
              onlyRenderVisibleElements
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_, n) => { if (n.type === "host") navigate(`/hosts/${n.id.slice(5)}`); }}
            >
              <Background color="rgb(var(--border))" gap={22} />
              <Controls className="!border-border !bg-card !shadow-card [&>button]:!border-border [&>button]:!bg-card [&>button]:!fill-[rgb(var(--ink))]" showInteractive={false} />
              {nodes.length > 30 && (
                <MiniMap pannable zoomable className="!bg-card"
                  nodeColor={(n) => (n.type === "host" ? statusMeta((n.data as { view: HostView }).view.status).color : "transparent")}
                  maskColor="rgb(var(--bg) / 0.6)" />
              )}
            </ReactFlow>
          </div>
        </Card>
      )}

      {/* Légende : ce que représentent les cadres et les traits */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-soft">
        <span className="eyebrow">{t("topo.legend")}</span>
        {(["CRITICAL", "WARNING", "UNKNOWN", "OK"] as const).map((s) => {
          const m = statusMeta(s);
          return <span key={s} className="flex items-center gap-1.5"><m.icon className="h-3.5 w-3.5" style={{ color: m.color }} aria-hidden /> {m.label}</span>;
        })}
        <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-accent-violet" aria-hidden /> {t("topo.legendDep")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-border" aria-hidden /> {t("topo.legendGroup")}</span>
      </Card>
    </div>
  );
}
