import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Bell, Check, Clock, Sparkles, Loader2, Wrench, CheckCircle2, XCircle, Ticket } from "lucide-react";
import type { Incident } from "../../types";
import type { RemediationAction } from "../../api/endpoints";
import { statusMeta } from "../../lib/status";
import { timeAgo } from "../../lib/format";
import { cn } from "../../lib/cn";
import { fadeUp } from "./Card";
import { StatusBadge } from "./StatusBadge";
import { useI18n } from "../../lib/i18n";

export interface AnalysisState {
  loading: boolean;
  text?: string;
  error?: string;
  suggested?: string | null;
  actions?: RemediationAction[];
}

export interface RemediationState {
  loading?: string; // id de l'action en cours
  text?: string;
  ok?: boolean;
}

export function AlertCard({
  incident,
  acknowledged,
  onAck,
  onAnalyze,
  analysis,
  onRemediate,
  remediation,
  onTicket,
  ticketBusy,
}: {
  incident: Incident;
  acknowledged?: boolean;
  onAck?: (id: number) => void;
  onAnalyze?: (id: number) => void;
  analysis?: AnalysisState;
  onRemediate?: (id: number, action: string) => void;
  remediation?: RemediationState;
  onTicket?: (id: number) => void;
  ticketBusy?: boolean;
}) {
  const { t } = useI18n();
  const meta = statusMeta(incident.status);
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "card border-l-4 p-4",
        acknowledged && "opacity-60",
      )}
      style={{ borderLeftColor: meta.color }}
    >
      <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 rounded-lg p-2", meta.soft)}>
        <Bell className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={incident.status} size="xs" />
          <Link to={`/hosts/${incident.host_id}`} className="text-sm font-medium text-ink hover:text-brand">
            {incident.host_name}
          </Link>
          <span className="text-ink-faint">/</span>
          <Link to={`/checks/${incident.check_id}`} className="text-sm text-ink-soft hover:text-brand">
            {incident.check_name}
          </Link>
        </div>
        {incident.message && <p className="mt-1 text-sm text-ink-soft">{incident.message}</p>}
        <p className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {timeAgo(incident.since)}
          </span>
          {acknowledged && incident.acknowledged_by && (
            <span className="rounded bg-status-info/10 px-1.5 py-0.5 text-status-info">
              {t("alert.ackedBy")} {incident.acknowledged_by}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        {onAck && (
          <button
            onClick={() => onAck(incident.alert_id)}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title={acknowledged ? t("alert.unack") : t("alert.ack")}
          >
            <Check className="h-3.5 w-3.5" />
            {acknowledged ? t("alert.acked") : t("alert.ack")}
          </button>
        )}
        {onAnalyze && (
          <button
            onClick={() => onAnalyze(incident.alert_id)}
            disabled={analysis?.loading}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title={t("alert.analyzeAi")}
          >
            {analysis?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analysis?.loading ? t("alert.analyzing") : t("alert.analyzeAiBtn")}
          </button>
        )}
        {onTicket && (
          <button
            onClick={() => onTicket(incident.alert_id)}
            disabled={ticketBusy}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title={t("alert.openTicket")}
          >
            {ticketBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
            {t("alert.ticket")}
          </button>
        )}
      </div>
      </div>

      <AnimatePresence>
        {analysis && (analysis.text || analysis.error) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-lg border border-border bg-bg-soft/60 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Sparkles className="h-3.5 w-3.5" /> {t("alert.aiAnalysis")}
              </p>
              {analysis.error ? (
                <p className="text-sm text-status-critical">{analysis.error}</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{analysis.text}</p>
              )}

              {/* Remédiation semi-automatique (Niveau 1) */}
              {onRemediate && analysis.actions && analysis.actions.length > 0 && !analysis.error && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <Wrench className="h-3.5 w-3.5" /> {t("alert.remediation")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.actions.map((a) => {
                      const isSuggested = a.id === analysis.suggested;
                      const busy = remediation?.loading === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => onRemediate(incident.alert_id, a.id)}
                          disabled={!!remediation?.loading}
                          title={a.description}
                          className={cn("btn-ghost px-2.5 py-1.5 text-xs", isSuggested && "border-accent-violet/50")}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : isSuggested ? <Sparkles className="h-3.5 w-3.5 text-accent-violet" aria-hidden /> : null}
                          {a.label}
                          {isSuggested && <span className="rounded bg-accent-violet/15 px-1 text-[10px] font-semibold text-accent-violet">{t("alert.suggestedAi")}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {remediation?.text && (
                    <p className={cn("mt-2 flex items-center gap-1.5 text-xs", remediation.ok ? "text-status-ok" : "text-status-critical")}>
                      {remediation.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {remediation.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
