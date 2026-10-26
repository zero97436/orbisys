import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Filter, BellRing } from "lucide-react";
import { ackIncident, analyzeIncident, createTicket, getAgentCommand, getIncidents, remediateIncident, unackIncident } from "../api/endpoints";
import { useNavigate } from "react-router-dom";
import type { AnalysisState, RemediationState } from "../components/ui/AlertCard";
import type { CheckStatus } from "../types";
import { usePolling } from "../hooks/usePolling";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, MotionGrid } from "../components/ui/Card";
import { AlertCard } from "../components/ui/AlertCard";
import { MetricCard } from "../components/ui/MetricCard";
import { ErrorState, Loading } from "../components/States";
import { MaintenancePanel } from "../components/MaintenancePanel";
import { cn } from "../lib/cn";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";

const FILTERS: (CheckStatus | "ALL")[] = ["ALL", "CRITICAL", "WARNING", "UNKNOWN"];

export default function IncidentCenterPage() {
  const { t } = useI18n();
  const { data: incidents, error, loading, refresh } = usePolling(
    () => getIncidents().then((r) => r.data),
    10000,
  );
  const [filter, setFilter] = useState<CheckStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const editable = canEdit(user);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  // Suivi des commandes d'agent : intervalles arrêtés si l'utilisateur quitte la page.
  const timers = useRef(new Set<ReturnType<typeof setInterval>>());
  useEffect(() => () => { timers.current.forEach(clearInterval); }, []);

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

  const list = incidents ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { CRITICAL: 0, WARNING: 0, UNKNOWN: 0 };
    for (const i of list) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [list]);
  const ackedCount = list.filter((i) => i.acknowledged).length;

  const filtered = list.filter((i) => {
    if (filter !== "ALL" && i.status !== filter) return false;
    const hay = `${i.host_name} ${i.check_name} ${i.message ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const toggleAck = async (id: number, acknowledged: boolean) => {
    try {
      await (acknowledged ? unackIncident(id) : ackIncident(id));
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
    refresh();
  };

  const [analyses, setAnalyses] = useState<Record<number, AnalysisState>>({});
  const analyze = async (id: number) => {
    setAnalyses((p) => ({ ...p, [id]: { loading: true } }));
    try {
      const { data } = await analyzeIncident(id);
      setAnalyses((p) => ({
        ...p,
        [id]: {
          loading: false,
          text: data.analysis,
          suggested: data.suggested_action,
          actions: data.available_actions,
        },
      }));
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t("inc.analysisFailed");
      setAnalyses((p) => ({ ...p, [id]: { loading: false, error: detail } }));
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
        setRemediations((p) => ({
          ...p,
          [id]: { text: data.detail, ok: data.status === "success" },
        }));
        refresh();
      }
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t("inc.actionFailed");
      setRemediations((p) => ({ ...p, [id]: { text: detail, ok: false } }));
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
          setRemediations((p) => ({
            ...p,
            [incidentId]: { text: data.result ?? t("inc.noResult"), ok: data.status === "done" },
          }));
        }
      } catch {
        /* on continue d'essayer */
      }
      if (tries >= 20) {
        clearInterval(timer);
        timers.current.delete(timer);
        setRemediations((p) => ({
          ...p,
          [incidentId]: { text: t("inc.agentNoReply"), ok: false },
        }));
      }
    }, 3000);
    timers.current.add(timer);
  };

  if (loading && !incidents) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader titleKey="page.incidents.title" subtitleKey="page.incidents.sub" helpTopic="incidents" />

      <MaintenancePanel />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={t("inc.totalActive")} value={list.length} icon={BellRing} accent={list.length ? "critical" : "ok"} />
        <MetricCard label="Critical" value={counts.CRITICAL} icon={BellRing} accent="critical" />
        <MetricCard label="Warning" value={counts.WARNING} icon={BellRing} accent="warning" />
        <MetricCard label={t("inc.acked")} value={ackedCount} icon={BellRing} accent="info" />
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("inc.searchPh")} className="input w-full pl-9" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-soft p-1">
          <Filter className="mx-1 h-4 w-4 text-ink-faint" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition",
                filter === f ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {f === "ALL" ? t("common.all") : f}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-status-ok">{t("inc.noneMatch")}</p>
      ) : (
        <MotionGrid className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((inc) => (
            <AlertCard
              key={inc.alert_id}
              incident={inc}
              acknowledged={inc.acknowledged}
              onAck={editable ? () => toggleAck(inc.alert_id, inc.acknowledged) : undefined}
              onAnalyze={analyze}
              analysis={analyses[inc.alert_id]}
              onRemediate={editable ? remediate : undefined}
              remediation={remediations[inc.alert_id]}
              onTicket={editable ? openTicket : undefined}
              ticketBusy={ticketBusy === inc.alert_id}
            />
          ))}
        </MotionGrid>
      )}
    </div>
  );
}
