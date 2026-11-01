import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, BellRing, CheckCircle2, XCircle } from "lucide-react";
import { ackIncident, analyzeIncident, createTicket, getAgentCommand, getIncidents, remediateIncident, unackIncident } from "../api/endpoints";
import type { AnalysisState, RemediationState } from "../components/ui/AlertCard";
import type { CheckStatus } from "../types";
import { usePolling } from "../hooks/usePolling";
import { PageHeader } from "../components/ui/PageHeader";
import { MotionGrid } from "../components/ui/Card";
import { AlertCard } from "../components/ui/AlertCard";
import { MetricCard } from "../components/ui/MetricCard";
import { FilterChips, SearchInput } from "../components/ui/ListControls";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { MaintenancePanel } from "../components/MaintenancePanel";
import { IncidentDetail } from "../components/incidents/IncidentDetail";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { prioritizeIncidents } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { useLiveStatus } from "../lib/liveStatus";
import { apiErrorMessage } from "../lib/apiError";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";

type StatusFilter = CheckStatus | "ALL";
type SortKey = "priority" | "oldest" | "newest";

export default function IncidentCenterPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const live = useLiveStatus();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editable = canEdit(user);
  const { data: incidents, error, loading, refresh } = usePolling(() => getIncidents().then((r) => r.data), 10000);
  // Après une action : rafraîchit la page et l'état partagé (badge de la barre supérieure).
  const refreshAll = () => { refresh(); live.refresh(); };

  const [params, setParams] = useSearchParams();
  const openId = Number(params.get("open")) || null;
  const setOpenId = (id: number | null) =>
    setParams((p) => { if (id) p.set("open", String(id)); else p.delete("open"); return p; }, { replace: true });

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [onlyUnacked, setOnlyUnacked] = useState(false);
  const [sort, setSort] = useState<SortKey>("priority");
  const [q, setQ] = useState("");

  // Suivi des commandes d'agent : intervalles arrêtés si l'utilisateur quitte la page.
  const timers = useRef(new Set<ReturnType<typeof setInterval>>());
  useEffect(() => () => { timers.current.forEach(clearInterval); }, []);

  const list = incidents ?? [];
  const counts = useMemo(() => {
    const c: Record<CheckStatus, number> = { CRITICAL: 0, WARNING: 0, UNKNOWN: 0, OK: 0 };
    for (const i of list) c[i.status] += 1;
    return c;
  }, [list]);
  const unackedCount = list.filter((i) => !i.acknowledged).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = list.filter((i) =>
      (filter === "ALL" || i.status === filter) &&
      (!onlyUnacked || !i.acknowledged) &&
      (!needle || `${i.host_name} ${i.check_name} ${i.message ?? ""}`.toLowerCase().includes(needle)),
    );
    if (sort === "priority") return prioritizeIncidents(rows);
    const dir = sort === "oldest" ? 1 : -1;
    return [...rows].sort((a, b) => (+new Date(a.since) - +new Date(b.since)) * dir);
  }, [list, filter, onlyUnacked, q, sort]);

  const [ticketBusy, setTicketBusy] = useState<number | null>(null);
  const openTicket = async (alertId: number) => {
    setTicketBusy(alertId);
    try {
      await createTicket({ alert_id: alertId });
      navigate("/tickets");
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setTicketBusy(null);
    }
  };

  const toggleAck = async (id: number, acknowledged: boolean) => {
    try {
      await (acknowledged ? unackIncident(id) : ackIncident(id));
      toast.success(acknowledged ? t("inc.unacked1") : t("inc.acked1"));
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
    refreshAll();
  };

  const [analyses, setAnalyses] = useState<Record<number, AnalysisState>>({});
  const analyze = async (id: number) => {
    setOpenId(id);
    setAnalyses((p) => ({ ...p, [id]: { loading: true } }));
    try {
      const { data } = await analyzeIncident(id);
      setAnalyses((p) => ({ ...p, [id]: { loading: false, text: data.analysis, suggested: data.suggested_action, actions: data.available_actions } }));
    } catch (e) {
      setAnalyses((p) => ({ ...p, [id]: { loading: false, error: apiErrorMessage(e, t("inc.analysisFailed")) } }));
    }
  };

  const [remediations, setRemediations] = useState<Record<number, RemediationState>>({});
  const remediate = async (id: number, action: string) => {
    // Validation humaine explicite avant toute action exécutée sur l'infrastructure.
    const inc = list.find((i) => i.alert_id === id);
    const meta = analyses[id]?.actions?.find((a) => a.id === action);
    const ok = await confirm({
      title: t("rem.confirmTitle"),
      message: (
        <>
          <p>{t("rem.confirmBody")}</p>
          {meta?.description && <p className="mt-2 text-ink">{meta.description}</p>}
          {analyses[id]?.suggested === action && <p className="mt-2 text-xs text-ink-faint">{t("rem.aiSuggestedNote")}</p>}
        </>
      ),
      details: `${meta?.label ?? action} → ${inc ? `${inc.host_name} / ${inc.check_name}` : `#${id}`}`,
      confirmLabel: t("rem.execute"),
      tone: "danger",
    });
    if (!ok) return;
    setRemediations((p) => ({ ...p, [id]: { loading: action } }));
    try {
      const { data } = await remediateIncident(id, action);
      if (data.command_id) {
        // Action exécutée par l'agent : on suit la commande jusqu'au résultat.
        setRemediations((p) => ({ ...p, [id]: { text: t("inc.waitingAgent"), ok: true } }));
        pollCommand(id, data.command_id);
      } else {
        setRemediations((p) => ({ ...p, [id]: { text: data.detail, ok: data.status === "success" } }));
        refreshAll();
      }
    } catch (e) {
      setRemediations((p) => ({ ...p, [id]: { text: apiErrorMessage(e, t("inc.actionFailed")), ok: false } }));
    }
  };

  const pollCommand = (incidentId: number, commandId: number) => {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const { data } = await getAgentCommand(commandId);
        if (data.status === "done" || data.status === "failed") {
          clearInterval(timer);
          timers.current.delete(timer);
          setRemediations((p) => ({ ...p, [incidentId]: { text: data.result ?? t("inc.noResult"), ok: data.status === "done" } }));
          refreshAll();
          return;
        }
      } catch {
        /* on continue d'essayer */
      }
      if (tries >= 20) {
        clearInterval(timer);
        timers.current.delete(timer);
        setRemediations((p) => ({ ...p, [incidentId]: { text: t("inc.agentNoReply"), ok: false } }));
      }
    }, 3000);
    timers.current.add(timer);
  };

  if (loading && !incidents) return <Loading />;
  if (error && !incidents) return <ErrorState message={error} onRetry={refresh} />;

  const current = openId ? list.find((i) => i.alert_id === openId) ?? null : null;

  return (
    <div className="space-y-5">
      <PageHeader titleKey="page.incidents.title" subtitleKey="page.incidents.sub" helpTopic="incidents" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={t("inc.totalActive")} value={list.length} icon={BellRing} accent={list.length ? "critical" : "ok"} />
        <MetricCard label={t("inc.critical")} value={counts.CRITICAL} icon={XCircle} accent={counts.CRITICAL ? "critical" : "neutral"} />
        <MetricCard label={t("inc.warning")} value={counts.WARNING} icon={AlertTriangle} accent={counts.WARNING ? "warning" : "neutral"} />
        <MetricCard label={t("inc.unacked")} value={unackedCount} icon={BellRing} accent={unackedCount ? "warning" : "ok"} />
      </div>

      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("inc.searchPh")} className="min-w-[220px] flex-1" />
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand-rgb))]" checked={onlyUnacked} onChange={(e) => setOnlyUnacked(e.target.checked)} />
            {t("inc.onlyUnacked")}
          </label>
          <label className="sr-only" htmlFor="inc-sort">{t("inc.sort")}</label>
          <select id="inc-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(["priority", "oldest", "newest"] as const).map((k) => <option key={k} value={k}>{t(`inc.sort.${k}`)}</option>)}
          </select>
        </div>
        <FilterChips<StatusFilter>
          label={t("list.statusFilter")}
          value={filter}
          onChange={setFilter}
          options={[
            { v: "ALL", label: t("common.all"), count: list.length },
            ...(["CRITICAL", "WARNING", "UNKNOWN"] as const).map((s) => ({ v: s, label: t(`status.${s}`), count: counts[s], tone: statusMeta(s).dot })),
          ]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("dash.allUnderControl")} message={t("inc.noneActive")} />
      ) : filtered.length === 0 ? (
        <EmptyState message={t("list.noMatch")} action={<button type="button" className="btn-ghost" onClick={() => { setQ(""); setFilter("ALL"); setOnlyUnacked(false); }}>{t("list.reset")}</button>} />
      ) : (
        <MotionGrid className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((inc) => (
            <AlertCard
              key={inc.alert_id}
              incident={inc}
              acknowledged={inc.acknowledged}
              onOpen={setOpenId}
              onAck={editable ? () => toggleAck(inc.alert_id, inc.acknowledged) : undefined}
              onAnalyze={analyze}
              onTicket={editable ? openTicket : undefined}
              ticketBusy={ticketBusy === inc.alert_id}
            />
          ))}
        </MotionGrid>
      )}

      <MaintenancePanel />

      <IncidentDetail
        incident={current}
        open={!!current}
        onClose={() => setOpenId(null)}
        related={list}
        editable={editable}
        analysis={current ? analyses[current.alert_id] : undefined}
        onAnalyze={analyze}
        remediation={current ? remediations[current.alert_id] : undefined}
        onRemediate={editable ? remediate : undefined}
        onAck={editable ? toggleAck : undefined}
        onTicket={editable ? openTicket : undefined}
        ticketBusy={!!current && ticketBusy === current.alert_id}
      />
    </div>
  );
}
