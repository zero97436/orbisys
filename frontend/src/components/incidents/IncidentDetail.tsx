import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Bell, Check, CheckCircle2, Clock, GitBranch, History, Loader2, Sparkles, Ticket, Wrench, XCircle,
} from "lucide-react";
import { listEvents, listHosts, listResults } from "../../api/endpoints";
import type { CheckResult, EventLog, Host, Incident } from "../../types";
import { Modal } from "../ui/Modal";
import { StatusBadge } from "../ui/StatusBadge";
import { ResponseTimeChart } from "../charts/ResponseTimeChart";
import type { AnalysisState, RemediationState } from "../ui/AlertCard";
import { responseTimeSeries } from "../../lib/series";
import { formatDate, formatTime, uptimeSince } from "../../lib/format";
import { statusMeta } from "../../lib/status";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

/** Types d'événements du journal qui concernent le cycle de vie d'un incident. */
const EVENT_ICON: Record<string, typeof Bell> = {
  alert_opened: Bell,
  alert_resolved: CheckCircle2,
  alert_escalated: AlertTriangle,
  alert_acknowledged: Check,
  alert_unacknowledged: Bell,
  alert_suppressed: Wrench,
  alert_suppressed_dependency: GitBranch,
  alert_suppressed_flapping: History,
  remediation: Wrench,
};

function Section({ title, icon: Icon, children, aside }: { title: string; icon: typeof Bell; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="eyebrow flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" aria-hidden /> {title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Fiche incident : uniquement des données enregistrées (journal d'événements du check,
 *  derniers résultats, incidents et dépendances réels). L'analyse IA est présentée
 *  comme une hypothèse ; toute action passe par la confirmation de la page. */
export function IncidentDetail({
  incident, open, onClose, related, editable,
  analysis, onAnalyze, remediation, onRemediate, onAck, onTicket, ticketBusy,
}: {
  incident: Incident | null;
  open: boolean;
  onClose: () => void;
  related: Incident[];
  editable: boolean;
  analysis?: AnalysisState;
  onAnalyze: (id: number) => void;
  remediation?: RemediationState;
  onRemediate?: (id: number, action: string) => void;
  onAck?: (id: number, acknowledged: boolean) => void;
  onTicket?: (id: number) => void;
  ticketBusy?: boolean;
}) {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventLog[] | null>(null);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    if (!open || !incident) return;
    setEvents(null);
    setResults(null);
    listEvents({ check_id: incident.check_id, limit: 50 }).then((r) => setEvents(r.data)).catch(() => setEvents([]));
    listResults(incident.check_id, 120).then((r) => setResults(r.data)).catch(() => setResults([]));
    listHosts().then((r) => setHosts(r.data)).catch(() => setHosts([]));
  }, [open, incident?.alert_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!incident) return null;
  const meta = statusMeta(incident.status);
  const host = hosts.find((h) => h.id === incident.host_id);
  const parent = host?.parent_host_id ? hosts.find((h) => h.id === host.parent_host_id) : undefined;
  const dependents = hosts.filter((h) => h.parent_host_id === incident.host_id);
  const sameHost = related.filter((i) => i.host_id === incident.host_id && i.alert_id !== incident.alert_id);
  const parentIncidents = parent ? related.filter((i) => i.host_id === parent.id) : [];
  const rt = results ? responseTimeSeries(results) : [];
  const executed = (events ?? []).filter((e) => e.type === "remediation");

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="drawer"
      size="xl"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={incident.status} size="xs" />
          <span>{incident.host_name} / {incident.check_name}</span>
        </span>
      }
      description={incident.message ?? undefined}
      footer={
        <>
          {onTicket && (
            <button type="button" className="btn-ghost" onClick={() => onTicket(incident.alert_id)} disabled={ticketBusy}>
              {ticketBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ticket className="h-4 w-4" aria-hidden />} {t("alert.ticket")}
            </button>
          )}
          {onAck && (
            <button type="button" className={incident.acknowledged ? "btn-ghost" : "btn-primary"} onClick={() => onAck(incident.alert_id, incident.acknowledged)}>
              <Check className="h-4 w-4" aria-hidden /> {incident.acknowledged ? t("alert.unack") : t("alert.ack")}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Résumé */}
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-bg-soft/50 p-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="eyebrow">{t("incd.severity")}</dt>
            <dd className={cn("mt-1 flex items-center gap-1 font-medium", meta.text)}><meta.icon className="h-4 w-4" aria-hidden /> {meta.label}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("incd.since")}</dt>
            <dd className="mt-1 font-medium text-ink" title={formatDate(incident.since)}>{uptimeSince(incident.since)}</dd>
            <dd className="text-xs text-ink-faint">{formatDate(incident.since)}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("ten.host")}</dt>
            <dd className="mt-1"><Link to={`/hosts/${incident.host_id}`} className="font-medium text-brand hover:underline">{incident.host_name}</Link></dd>
          </div>
          <div>
            <dt className="eyebrow">{t("incd.state")}</dt>
            <dd className="mt-1 text-ink">
              {incident.acknowledged
                ? <>{t("alert.acked")}{incident.acknowledged_by && <span className="block text-xs text-ink-faint">{incident.acknowledged_by}{incident.acknowledged_at ? ` · ${formatDate(incident.acknowledged_at)}` : ""}</span>}</>
                : <span className="text-status-warning">{t("incd.notAcked")}</span>}
            </dd>
          </div>
        </dl>

        {/* Impact : dépendances réelles déclarées (parent_host_id) */}
        <Section title={t("incd.impact")} icon={GitBranch}>
          <ul className="space-y-1 text-sm text-ink-soft">
            {dependents.length > 0 ? (
              <li>
                {t("incd.dependents").replace("{n}", String(dependents.length))}{" "}
                {dependents.map((h, i) => <span key={h.id}>{i > 0 && ", "}<Link to={`/hosts/${h.id}`} className="text-brand hover:underline">{h.name}</Link></span>)}
              </li>
            ) : (
              <li>{t("incd.noDependents")}</li>
            )}
            {parent && (
              <li>
                {t("incd.parent")} <Link to={`/hosts/${parent.id}`} className="text-brand hover:underline">{parent.name}</Link>
                {parentIncidents.length > 0 && <span className="text-status-critical"> — {t("incd.parentDown")}</span>}
              </li>
            )}
          </ul>
        </Section>

        {/* Événements corrélés : autres incidents actifs du même hôte */}
        <Section title={`${t("incd.correlated")} (${sameHost.length + parentIncidents.length})`} icon={AlertTriangle}>
          {sameHost.length + parentIncidents.length === 0 ? (
            <p className="text-sm text-ink-faint">{t("incd.noCorrelated")}</p>
          ) : (
            <ul className="space-y-1">
              {[...parentIncidents, ...sameHost].map((i) => (
                <li key={i.alert_id} className="flex items-center gap-2 text-sm">
                  <StatusBadge status={i.status} size="xs" />
                  <span className="text-ink">{i.host_name} / {i.check_name}</span>
                  <span className="text-xs text-ink-faint">{uptimeSince(i.since)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Métriques associées : temps de réponse réels du check */}
        <Section title={t("incd.metrics")} icon={Clock} aside={<Link to={`/checks/${incident.check_id}`} className="text-xs text-brand hover:underline">{t("incd.openCheck")}</Link>}>
          {results === null ? (
            <p className="text-sm text-ink-faint"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />{t("common.loading")}</p>
          ) : rt.length ? (
            <ResponseTimeChart data={rt} height={160} />
          ) : (
            <p className="text-sm text-ink-faint">{t("incd.noMetrics")}</p>
          )}
        </Section>

        {/* Analyse IA : hypothèse, jamais une certitude */}
        <Section title={t("incd.ai")} icon={Sparkles}
          aside={!analysis?.loading && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onAnalyze(incident.alert_id)}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {analysis?.text ? t("incd.reanalyze") : t("alert.analyzeAiBtn")}
            </button>
          )}>
          {analysis?.loading ? (
            <p className="text-sm text-ink-faint"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />{t("alert.analyzing")}</p>
          ) : analysis?.error ? (
            <p role="alert" className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-ink">{analysis.error}</p>
          ) : analysis?.text ? (
            <div className="space-y-3 rounded-lg border border-accent-violet/30 bg-accent-violet/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-violet">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t("incd.aiDisclaimer")}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{analysis.text}</p>
              {onRemediate && analysis.actions && analysis.actions.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><Wrench className="h-3.5 w-3.5" aria-hidden /> {t("alert.remediation")}</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.actions.map((a) => {
                      const suggested = a.id === analysis.suggested;
                      return (
                        <button key={a.id} type="button" title={a.description} disabled={!!remediation?.loading}
                          onClick={() => onRemediate(incident.alert_id, a.id)}
                          className={cn("btn-ghost btn-sm", suggested && "border-accent-violet/50")}>
                          {remediation?.loading === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : suggested ? <Sparkles className="h-3.5 w-3.5 text-accent-violet" aria-hidden /> : null}
                          {a.label}
                          {suggested && <span className="rounded bg-accent-violet/15 px-1 text-[10px] font-semibold text-accent-violet">{t("alert.suggestedAi")}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {remediation?.text && (
                    <p className={cn("mt-2 flex items-center gap-1.5 text-xs", remediation.ok ? "text-status-ok" : "text-status-critical")}>
                      {remediation.ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />} {remediation.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">{editable ? t("incd.aiHint") : t("incd.aiHintRo")}</p>
          )}
        </Section>

        {/* Actions réellement exécutées (journal) */}
        <Section title={`${t("incd.executed")} (${executed.length})`} icon={Wrench}>
          {executed.length === 0 ? (
            <p className="text-sm text-ink-faint">{t("incd.noExecuted")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {executed.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", e.level === "info" ? "bg-status-ok" : "bg-status-warning")} aria-hidden />
                  <span className="min-w-0 flex-1 text-ink-soft">{e.message}</span>
                  <span className="shrink-0 text-xs text-ink-faint">{e.actor} · {formatDate(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Chronologie : journal d'événements du check */}
        <Section title={t("incd.timeline")} icon={History}>
          {events === null ? (
            <p className="text-sm text-ink-faint"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />{t("common.loading")}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-ink-faint">{t("incd.noEvents")}</p>
          ) : (
            <ol className="space-y-2 border-l border-border pl-4">
              {events.map((e) => {
                const Icon = EVENT_ICON[e.type] ?? History;
                const tone = e.level === "critical" ? "text-status-critical" : e.level === "warning" ? "text-status-warning" : "text-ink-faint";
                return (
                  <li key={e.id} className="relative">
                    <Icon className={cn("absolute -left-[25px] top-0.5 h-4 w-4 rounded-full bg-card", tone)} aria-hidden />
                    <p className="text-sm text-ink">{e.message}</p>
                    <p className="text-xs text-ink-faint">
                      <time dateTime={e.created_at} title={formatDate(e.created_at)}>{formatTime(e.created_at)}</time>
                      {" · "}{t(`ev.type.${e.type}`) === `ev.type.${e.type}` ? e.type : t(`ev.type.${e.type}`)}
                      {e.actor && e.actor !== "system" ? ` · ${e.actor}` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </Modal>
  );
}
