import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle, Bot, CheckCircle2, Cpu, Database, Loader2, Play, RotateCw, Send, Sparkles, Trash2, User as UserIcon, Wand2, XCircle,
} from "lucide-react";
import { chatAI, applyPlan, getAiStatus, type AiPlan, type AiStatus, type ApplyResult, type RagSource } from "../api/endpoints";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { useConfirm } from "../components/ui/Confirm";
import { apiErrorMessage } from "../lib/apiError";
import { localeOf } from "../lib/format";
import { cn } from "../lib/cn";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";

interface Msg {
  role: "user" | "assistant" | "error";
  content: string;
  /** Modèle ayant produit la réponse. */
  model?: string;
  /** Heure du relevé de supervision sur lequel la réponse s'appuie. */
  at?: number;
  plan?: AiPlan | null;
  applied?: ApplyResult | null;
  sources?: RagSource[];
}

const SUGGESTION_KEYS = ["chat.sug1", "chat.sug2", "chat.sug3", "chat.sug4"];

/** Assistant IA local. Distingue ce que dit le modèle (hypothèses, propositions) de ce qui
 *  a réellement été exécuté (résultat renvoyé par le serveur, après confirmation humaine). */
export default function ChatPage() {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const editable = canEdit(user);

  const checkStatus = () => getAiStatus().then((r) => setStatus(r.data)).catch(() => setStatus(null));
  useEffect(() => { checkStatus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const history = messages.filter((m) => m.role !== "error").slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await chatAI(question, history);
      setMessages((m) => [...m, { role: "assistant", content: data.answer, model: data.model, at: Date.now(), plan: data.plan, sources: data.sources }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", content: apiErrorMessage(e, t("chat.noAnswer")) }]);
      checkStatus();
    } finally {
      setLoading(false);
    }
  };

  const applyFromPlan = async (index: number, plan: AiPlan) => {
    const destructive = plan.operations.some((o) => o.destructive);
    // Toute modification de l'inventaire demandée par l'IA est confirmée par un humain.
    const ok = await confirm({
      title: t("chat.confirmTitle").replace("{n}", String(plan.operations.length)),
      message: <><p>{t("chat.confirmBody")}</p>{destructive && <p className="mt-2 font-medium text-status-critical">{t("chat.confirmDestructive")}</p>}</>,
      details: plan.operations.map((o, i) => <div key={i} className={o.destructive ? "text-status-critical" : undefined}>{o.destructive ? "✕ " : "+ "}{o.description}</div>),
      confirmLabel: t("chat.applyPlan"),
      tone: destructive ? "danger" : "primary",
      requireText: destructive ? t("chat.confirmWord") : undefined,
    });
    if (!ok) return;
    setApplyingIdx(index);
    try {
      const { data } = await applyPlan(plan);
      setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, plan: null, applied: data } : msg)));
    } catch (e) {
      setMessages((m) => [...m, { role: "error", content: apiErrorMessage(e, t("chat.applyFail")) }]);
    } finally {
      setApplyingIdx(null);
    }
  };

  const fmt = (ms: number) => new Date(ms).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" });
  const unavailable = status && (!status.available || !status.model_installed);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <PageHeader titleKey="page.chat.title" subtitleKey="page.chat.sub"
        actions={status && (
          <span role="status" className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
            unavailable ? "bg-status-warning/15 text-status-warning" : "bg-status-ok/10 text-status-ok")}>
            <Cpu className="h-3.5 w-3.5" aria-hidden />
            {status.model} · {!status.available ? t("chat.st.down") : !status.model_installed ? t("chat.st.missing") : t("chat.st.ok")}
          </span>
        )} />

      {unavailable && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-ink">
          <AlertTriangle className="h-5 w-5 shrink-0 text-status-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            {!status.available ? t("chat.downHint") : t("chat.missingHint").replace("{model}", status.model)}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={checkStatus}><RotateCw className="h-3.5 w-3.5" aria-hidden /> {t("common.retry")}</button>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label={t("page.chat.title")}>
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-brand">
                <Bot className="h-6 w-6" aria-hidden />
              </span>
              <p className="max-w-md text-sm text-ink-soft">{t("chat.emptyHint")}</p>
              <p className="max-w-md text-xs text-ink-faint">{t("chat.scopeHint")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTION_KEYS.map((k) => {
                  const s = t(k);
                  return <button key={k} type="button" onClick={() => send(s)} className="btn-ghost px-3 py-1.5 text-xs">{s}</button>;
                })}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                m.role === "user" ? "bg-bg-soft text-ink-soft" : m.role === "error" ? "bg-status-warning/15 text-status-warning" : "bg-brand/15 text-brand")}>
                {m.role === "user" ? <UserIcon className="h-4 w-4" aria-hidden /> : m.role === "error" ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
              </span>
              <div className={cn("max-w-[80%] space-y-2", m.role === "user" && "flex flex-col items-end")}>
                {m.role === "assistant" && (
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    <Sparkles className="h-3 w-3 text-accent-violet" aria-hidden />
                    {t("chat.generatedBy").replace("{model}", m.model ?? "?")}
                    {m.at && <span>· {t("chat.basedOn").replace("{time}", fmt(m.at))}</span>}
                  </p>
                )}
                <div role={m.role === "error" ? "alert" : undefined}
                  className={cn("whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "bg-brand text-white"
                      : m.role === "error" ? "border border-status-warning/40 bg-status-warning/10 text-ink"
                      : "border border-border bg-bg-soft/60 text-ink-soft")}>
                  {m.content}
                </div>

                {/* Sources de la base de connaissances utilisées par le modèle */}
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Database className="h-3 w-3 text-ink-faint" aria-hidden />
                    <span className="text-[11px] text-ink-faint">{t("chat.sources")}</span>
                    {m.sources.map((src) => (
                      <Link key={src.id} to="/knowledge" className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand hover:underline"
                        title={`${t("chat.relevance")} ${src.score}`}>{src.title}</Link>
                    ))}
                  </div>
                )}

                {/* Proposition du modèle : rien n'est exécuté tant qu'un opérateur ne l'a pas confirmée */}
                {m.plan && (
                  <div className="rounded-xl border border-accent-violet/30 bg-accent-violet/5 p-3">
                    <p className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
                      <Wand2 className="h-4 w-4 text-accent-violet" aria-hidden /> {t("chat.planProposed")} ({m.plan.operations.length} {t("chat.operations")})
                    </p>
                    <p className="mb-2 text-xs text-ink-faint">{t("chat.planNotExecuted")}</p>
                    <ul className="mb-3 space-y-1.5">
                      {m.plan.operations.map((o, oi) => (
                        <li key={oi} className={cn("flex items-start gap-2 text-xs", o.destructive ? "text-status-critical" : "text-ink-soft")}>
                          {o.destructive ? <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-label={t("chat.destructive")} /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />}
                          {o.description}
                        </li>
                      ))}
                    </ul>
                    {editable ? (
                      <button type="button" onClick={() => applyFromPlan(i, m.plan!)} disabled={applyingIdx !== null} className="btn-ghost btn-sm">
                        {applyingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                        {t("chat.reviewPlan")}
                      </button>
                    ) : (
                      <p className="text-xs text-ink-faint">{t("chat.operatorRequired")}</p>
                    )}
                  </div>
                )}

                {/* Ce qui a réellement été exécuté (réponse du serveur) */}
                {m.applied && (() => {
                  const all = m.applied.applied === m.applied.total;
                  return (
                    <div className={cn("rounded-xl border p-3 text-sm", all ? "border-status-ok/30 bg-status-ok/10" : "border-status-warning/40 bg-status-warning/10")}>
                      <p className={cn("mb-1 flex items-center gap-2 font-medium", all ? "text-status-ok" : "text-status-warning")}>
                        {all ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
                        {t("chat.executed")} : {m.applied.applied}/{m.applied.total} {t("chat.opsApplied")}
                      </p>
                      <ul className="space-y-1">
                        {m.applied.results.map((r, ri) => (
                          <li key={ri} className="flex items-center gap-2 text-xs text-ink-soft">
                            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                              r.status === "done" ? "bg-status-ok/15 text-status-ok" : r.status === "skipped" ? "bg-bg-soft text-ink-faint" : "bg-status-critical/15 text-status-critical")}>
                              {r.status === "done" ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
                              {t(`chat.res.${r.status}`) === `chat.res.${r.status}` ? r.status : t(`chat.res.${r.status}`)}
                            </span>
                            {r.host_id ? <Link to={`/hosts/${r.host_id}`} className="hover:underline">{r.detail}</Link> : r.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          ))}

          {loading && (
            <p className="flex items-center gap-2 text-sm text-ink-faint" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("chat.thinking")}
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("chat.inputPh")} aria-label={t("chat.inputPh")} className="input flex-1" />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary" aria-label={t("tk.send")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </button>
        </form>
      </Card>
    </div>
  );
}
