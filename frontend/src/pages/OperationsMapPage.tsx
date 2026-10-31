import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShoppingCart, Truck, Warehouse, Mail, Banknote, Users, Globe, Server,
  Database, Cloud, Network, Shield, Boxes, Activity, Briefcase,
  AlertTriangle, ArrowUpRight, Move, Save, RotateCcw, X, type LucideIcon,
} from "lucide-react";
import {
  listBam, getSummary, getIncidents, listHosts, listChecks, getAvailability,
  saveBamLayout, type BamService,
} from "../api/endpoints";
import type { CheckStatus } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Card, SectionTitle } from "../components/ui/Card";
import { AvailabilityChart } from "../components/charts/AvailabilityChart";
import { ErrorState, SkeletonGrid } from "../components/States";
import { availabilityStatus, statusMeta } from "../lib/status";
import { buildHostViews } from "../lib/fleet";
import { bucketsFromReport } from "../lib/series";
import { localeOf } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";
import { formatPercent } from "../lib/format";
import { cn } from "../lib/cn";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";

const DAY = 24 * 3600 * 1000;
const TILE_W = 208;
const TILE_H = 130;
const GAP_X = 22;
const GAP_Y = 60;
const PAD = 20;
const COLS = 4;

const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart, truck: Truck, warehouse: Warehouse, mail: Mail,
  finance: Banknote, hr: Users, globe: Globe, server: Server, database: Database,
  cloud: Cloud, network: Network, shield: Shield,
};
const LAYER_ORDER = ["Applications métier", "Back-Office", "Infrastructure", "Général"];
type XY = { x: number; y: number };

export default function OperationsMapPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const editable = canEdit(user);
  const confirm = useConfirm();
  const toast = useToast();

  const [edit, setEdit] = useState(false);
  const [pos, setPos] = useState<Record<number, XY>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);

  // Rafraîchissement réel toutes les 30 s (pause onglet masqué). La disponibilité 24 h
  // vient du calcul serveur (tous les checks), plus d'un échantillon de 16 checks.
  const { data, error, loading, refresh } = usePolling(async () => {
    const [b, s, i, h, c, a] = await Promise.all([
      listBam(), getSummary(), getIncidents(), listHosts(), listChecks(), getAvailability(24, 24),
    ]);
    return { bam: b.data, summary: s.data, incidents: i.data, hosts: h.data, checks: c.data, avail: a.data, at: Date.now() };
  }, 30000);
  // Pendant l'édition, on fige la liste : un rafraîchissement ne doit pas écraser le placement en cours.
  const [bam, setBam] = useState<BamService[]>([]);
  useEffect(() => { if (data && !edit) setBam(data.bam); }, [data, edit]);
  const load = async () => { refresh(); };

  // Placement auto par couche (fallback quand pas de position enregistrée).
  const autoLayout = useMemo<Record<number, XY>>(() => {
    const map = new Map<string, BamService[]>();
    for (const s of bam) {
      const k = s.category || "Général";
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    const layers = [...map.entries()].sort(
      (a, b) => (idx(a[0]) - idx(b[0])) || a[0].localeCompare(b[0]),
    );
    const out: Record<number, XY> = {};
    let y = PAD;
    for (const [, services] of layers) {
      services.forEach((s, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        out[s.id] = { x: PAD + col * (TILE_W + GAP_X), y: y + row * (TILE_H + GAP_Y) };
      });
      const rows = Math.ceil(services.length / COLS) || 1;
      y += rows * (TILE_H + GAP_Y) + GAP_Y / 2;
    }
    return out;
  }, [bam]);

  // Positions effectives = enregistrées, sinon auto.
  useEffect(() => {
    const p: Record<number, XY> = {};
    for (const s of bam) {
      p[s.id] = s.pos_x != null && s.pos_y != null
        ? { x: s.pos_x, y: s.pos_y }
        : (autoLayout[s.id] ?? { x: PAD, y: PAD });
    }
    setPos(p);
    setDirty(false);
  }, [bam, autoLayout]);

  const canvasHeight = useMemo(() => {
    const maxY = Object.values(pos).reduce((m, p) => Math.max(m, p.y), 0);
    return Math.max(520, maxY + TILE_H + PAD);
  }, [pos]);

  const traffic = useMemo(() => (data ? bucketsFromReport(data.avail.buckets, DAY) : []), [data]);

  /* ---- drag handlers ---- */
  const onDown = (e: React.PointerEvent, id: number) => {
    if (!edit) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const p = pos[id];
    drag.current = { id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const maxX = rect.width - TILE_W - 2;
    const maxY = canvasHeight - TILE_H - 2;
    const x = Math.max(0, Math.min(e.clientX - rect.left - drag.current.dx, maxX));
    const y = Math.max(0, Math.min(e.clientY - rect.top - drag.current.dy, maxY));
    const id = drag.current.id;
    setPos((prev) => ({ ...prev, [id]: { x, y } }));
    setDirty(true);
  };
  const onUp = () => { drag.current = null; };
  // Alternative clavier au glisser-déposer : flèches = 10 px, Maj + flèches = 50 px.
  const onKey = (e: React.KeyboardEvent, id: number) => {
    if (!edit) return;
    const step = e.shiftKey ? 50 : 10;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setPos((prev) => {
      const p = prev[id] ?? { x: PAD, y: PAD };
      return { ...prev, [id]: { x: Math.max(0, p.x + d[0]), y: Math.max(0, p.y + d[1]) } };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveBamLayout(bam.map((s) => ({ id: s.id, pos_x: Math.round(pos[s.id].x), pos_y: Math.round(pos[s.id].y) })));
      toast.success(t("common.saved"));
      setEdit(false);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    // Enregistré immédiatement pour tous les utilisateurs : confirmation explicite.
    if (!(await confirm({ title: t("ops.resetTitle"), message: t("ops.resetBody"), confirmLabel: t("ops.auto"), tone: "primary" }))) return;
    setSaving(true);
    try {
      await saveBamLayout(bam.map((s) => ({ id: s.id, pos_x: null, pos_y: null })));
      setEdit(false);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => {
    const p: Record<number, XY> = {};
    for (const s of bam) p[s.id] = s.pos_x != null && s.pos_y != null ? { x: s.pos_x, y: s.pos_y } : autoLayout[s.id];
    setPos(p);
    setDirty(false);
    setEdit(false);
  };

  if (loading && !data) return <SkeletonGrid count={6} />;
  if (!data) return <ErrorState message={error ?? t("common.loadError")} onRetry={refresh} />;
  const { summary, incidents, hosts, checks } = data;

  const c = summary.status_counts;
  const okServices = bam.filter((s) => s.status === "OK").length;
  const koServices = bam.filter((s) => s.status === "CRITICAL").length;
  const hostViews = buildHostViews(hosts, checks);
  const hostsUp = hostViews.filter((h) => h.status === "OK").length;
  const svcTotal = (c.OK ?? 0) + (c.WARNING ?? 0) + (c.CRITICAL ?? 0) + (c.UNKNOWN ?? 0);
  const checksHealth = svcTotal ? ((c.OK ?? 0) / svcTotal) * 100 : null;

  const overall: CheckStatus =
    koServices > 0 ? "CRITICAL"
    : bam.some((s) => s.status === "WARNING") ? "WARNING"
    : bam.length === 0 ? "UNKNOWN"
    : "OK";
  const meta = statusMeta(overall);

  return (
    <div className="space-y-6">
      <PageHeader
        titleKey="page.operations.title"
        subtitleKey="page.operations.sub"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={overall} />
            {editable && bam.length > 0 && !edit && (
              <button onClick={() => setEdit(true)} className="btn-ghost">
                <Move className="h-4 w-4" /> {t("ops.reorganize")}
              </button>
            )}
            {edit && (
              <>
                <button onClick={reset} disabled={saving} className="btn-ghost text-ink-faint" title={t("ops.autoTitle")}>
                  <RotateCcw className="h-4 w-4" /> {t("ops.auto")}
                </button>
                <button onClick={cancel} disabled={saving} className="btn-ghost">
                  <X className="h-4 w-4" /> {t("common.cancel")}
                </button>
                <button onClick={save} disabled={saving || !dirty} className="btn-primary">
                  <Save className="h-4 w-4" /> {saving ? "…" : t("common.save")}
                </button>
              </>
            )}
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label={t("ops.kpi.servicesOk")} value={bam.length ? `${okServices}/${bam.length}` : "—"} icon={Briefcase} tone={!bam.length ? "muted" : koServices ? "critical" : okServices === bam.length ? "ok" : "warning"} />
        <KpiTile label={t("ops.kpi.checksHealth")} value={checksHealth == null ? "—" : formatPercent(checksHealth, 1)} icon={Activity} tone={({ OK: "ok", WARNING: "warning", CRITICAL: "critical", UNKNOWN: "muted" } as const)[availabilityStatus(checksHealth)]} />
        <KpiTile label={t("ops.kpi.hostsOnline")} value={`${hostsUp}/${hosts.length}`} icon={Server} tone={!hosts.length ? "muted" : hostsUp === hosts.length ? "ok" : "warning"} />
        <KpiTile label={t("ops.kpi.activeIncidents")} value={incidents.length} icon={AlertTriangle} tone={incidents.length ? "critical" : "ok"} />
      </div>

      {/* Carte */}
      <div className="card overflow-hidden p-0">
        <div className="relative flex items-center justify-between px-6 py-4" style={{ background: `linear-gradient(120deg, ${meta.color}22, transparent 70%)` }}>
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ color: meta.color }}>{t("ops.globalTitle")}</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">
              {summary.hosts_total} {t("ops.hostsWord")} · {svcTotal} {t("ops.servicesWord")} · {bam.length} {t("ops.bizServices")}
            </p>
          </div>
          {edit
            ? <span className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-medium text-brand">{t("ops.editMode")}</span>
            : <span className={cn("hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs sm:flex", error ? "bg-status-warning/15 text-status-warning" : "bg-bg-soft text-ink-soft")}
                role="status" title={t("ops.refreshEvery")}>
                {error ? t("live.staleShort") : t("live.updated")} {new Date(data.at).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>}
        </div>

        {bam.length === 0 ? (
          <EmptyMap />
        ) : (
          <div className="overflow-x-auto">
            <div
              ref={canvasRef}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              className={cn("relative mx-auto", edit && "select-none")}
              style={{
                height: canvasHeight,
                minWidth: PAD * 2 + COLS * TILE_W + (COLS - 1) * GAP_X,
                backgroundImage: edit
                  ? "radial-gradient(circle, rgba(148,163,184,0.16) 1px, transparent 1px)"
                  : undefined,
                backgroundSize: edit ? "22px 22px" : undefined,
              }}
            >
              {bam.map((s) => {
                const p = pos[s.id] ?? { x: PAD, y: PAD };
                return (
                  <div
                    key={s.id}
                    onPointerDown={(e) => onDown(e, s.id)}
                    onKeyDown={(e) => onKey(e, s.id)}
                    tabIndex={edit ? 0 : undefined}
                    role={edit ? "button" : undefined}
                    aria-label={edit ? `${s.name} — ${t("ops.moveHint")}` : undefined}
                    className={cn("absolute rounded-xl", edit ? "cursor-move touch-none focus-visible:ring-2 focus-visible:ring-brand" : "")}
                    style={{ left: p.x, top: p.y, width: TILE_W }}
                  >
                    <ServiceTile svc={s} interactive={!edit} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Card>
        <SectionTitle title={t("ops.trend24")} icon={Activity} />
        <AvailabilityChart data={traffic} height={200} />
      </Card>
    </div>
  );
}

function idx(layer: string): number {
  const i = LAYER_ORDER.indexOf(layer);
  return i === -1 ? LAYER_ORDER.length : i;
}

/* ---------- Tuile ---------- */
function ServiceTile({ svc, interactive }: { svc: BamService; interactive: boolean }) {
  const { t } = useI18n();
  const meta = statusMeta(svc.status);
  const Icon = (svc.icon && ICONS[svc.icon]) || Boxes;
  const ratio = svc.total ? (svc.ok_count / svc.total) * 100 : 0;

  const inner = (
    <>
      {interactive && <ArrowUpRight className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />}
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: `${meta.color}26`, color: meta.color }}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{svc.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", svc.status !== "OK" && "animate-pulse")} style={{ background: meta.color }} />
            <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-ink-faint">
          <span>{svc.ok_count}/{svc.total} {t("ops.componentsOk")}</span>
          <span className="tabular-nums">{formatPercent(ratio, 0)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, background: meta.color }} />
        </div>
      </div>
    </>
  );

  const cls = "group relative block overflow-hidden rounded-xl border p-4";
  const style = { borderColor: `${meta.color}55`, background: `linear-gradient(135deg, ${meta.color}1f, ${meta.color}0a)` };

  if (!interactive) {
    return <div className={cn(cls, "shadow-md")} style={style}>{inner}</div>;
  }
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
      <Link to="/bam" className={cn(cls, "transition-all hover:-translate-y-0.5 hover:shadow-lg")} style={style}>{inner}</Link>
    </motion.div>
  );
}

/* ---------- KPI ---------- */
const TONE: Record<string, string> = {
  ok: "rgb(var(--st-ok))", warning: "rgb(var(--st-warning))", critical: "rgb(var(--st-critical))", muted: "rgb(var(--st-unknown))",
};
function KpiTile({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: LucideIcon; tone: string }) {
  const color = TONE[tone] ?? TONE.muted;
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-bg-soft" style={{ color }}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
        <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

function EmptyMap() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <Boxes className="h-12 w-12 text-ink-faint" />
      <p className="text-sm font-medium text-ink">{t("ops.emptyTitle")}</p>
      <p className="max-w-md text-xs text-ink-faint">{t("ops.emptyDesc")}</p>
      <Link to="/bam" className="btn-primary mt-1 px-4 py-2 text-sm">
        <Briefcase className="h-4 w-4" /> {t("ops.configure")}
      </Link>
    </div>
  );
}
