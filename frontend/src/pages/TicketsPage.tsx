import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Trash2, ExternalLink, Ticket as TicketIcon, Zap, ListChecks, X, ChevronDown, ChevronUp, Pencil, Save, MessageSquare, Send, UserCheck } from "lucide-react";
import {
  listTickets, createTicket, setTicketStatus, deleteTicket, getTicketConfig,
  addTicketTask, updateTicketTask, deleteTicketTask,
  updateTicket, addTicketComment, deleteTicketComment, listTicketAssignees,
  type Ticket, type TicketConfig, type TicketAssignee,
} from "../api/endpoints";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, MotionGrid } from "../components/ui/Card";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { SearchInput } from "../components/ui/ListControls";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const STATUS_KEY: Record<string, string> = {
  open: "tk.status.open", in_progress: "tk.status.in_progress", resolved: "tk.status.resolved", closed: "tk.status.closed",
};
const STATUS_COLOR: Record<string, string> = {
  open: "rgb(var(--st-critical))", in_progress: "rgb(var(--st-warning))", resolved: "rgb(var(--st-ok))", closed: "rgb(var(--st-unknown))",
};
const PRIO_COLOR: Record<string, string> = {
  low: "rgb(var(--st-unknown))", medium: "rgb(var(--st-info))", high: "rgb(var(--st-warning))", critical: "rgb(var(--st-critical))",
};
const PRIO_KEY: Record<string, string> = {
  low: "tk.prio.low", medium: "tk.prio.medium", high: "tk.prio.high", critical: "tk.prio.critical",
};

export default function TicketsPage() {
  const { t: tr } = useI18n();
  const { user } = useAuth();
  const editable = canEdit(user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", priority: "medium", description: "" });

  const [assignees, setAssignees] = useState<TicketAssignee[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const load = () => {
    // La configuration et les assignables sont facultatifs : un échec ne vide pas la liste.
    Promise.all([listTickets(), getTicketConfig().catch(() => null), listTicketAssignees().catch(() => null)])
      .then(([t, c, a]) => { setTickets(t.data); if (c) setConfig(c.data); if (a) setAssignees(a.data); setLoadError(null); })
      .catch(() => setLoadError(tr("common.loadError")))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Exécute une modification, affiche l'erreur serveur éventuelle, puis recharge. */
  const act = async (fn: () => Promise<unknown>, okMsg?: string): Promise<boolean> => {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, tr("common.actionFailed")));
      return false;
    } finally {
      load();
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act(() => createTicket({ title: form.title, priority: form.priority, description: form.description || undefined }), tr("tk.created"));
    if (!ok) return;
    setForm({ title: "", priority: "medium", description: "" });
    setShowForm(false);
  };
  const changeStatus = (id: number, status: string) => act(() => setTicketStatus(id, status));
  const remove = async (tk: Ticket) => {
    const ok = await confirm({ title: tr("tk.confirmDelete"), message: tr("tk.deleteBody"), details: `#${tk.id} · ${tk.title}`, confirmLabel: tr("common.delete"), tone: "danger" });
    if (ok) act(() => deleteTicket(tk.id), tr("tk.deleted"));
  };

  const [newTask, setNewTask] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const addTask = async (ticketId: number) => {
    const label = (newTask[ticketId] ?? "").trim();
    if (!label) return;
    if (await act(() => addTicketTask(ticketId, label))) setNewTask((p) => ({ ...p, [ticketId]: "" }));
  };
  const toggleTask = (taskId: number, done: boolean) => act(() => updateTicketTask(taskId, { done }));
  const removeTask = async (taskId: number, label: string) => {
    const ok = await confirm({ title: tr("tk.deleteTaskTitle"), details: label, confirmLabel: tr("common.delete"), tone: "danger" });
    if (ok) act(() => deleteTicketTask(taskId));
  };

  // Édition inline : un ticket à la fois, brouillon local.
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "", priority: "medium" });
  const startEdit = (t: Ticket) => {
    setEditing(t.id);
    setDraft({ title: t.title, description: t.description ?? "", priority: t.priority });
  };
  const saveEdit = async () => {
    if (editing == null) return;
    if (!draft.title.trim()) return;
    if (await act(() => updateTicket(editing, { title: draft.title.trim(), description: draft.description, priority: draft.priority }), tr("common.saved"))) setEditing(null);
  };

  // Suivis (commentaires).
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const postComment = async (ticketId: number) => {
    const body = (newComment[ticketId] ?? "").trim();
    if (!body) return;
    if (await act(() => addTicketComment(ticketId, body))) setNewComment((p) => ({ ...p, [ticketId]: "" }));
  };
  const removeComment = async (id: number, body: string) => {
    const ok = await confirm({ title: tr("tk.deleteCommentTitle"), details: body.slice(0, 160), confirmLabel: tr("common.delete"), tone: "danger" });
    if (ok) act(() => deleteTicketComment(id));
  };
  const assign = (ticketId: number, value: string) => act(() => updateTicket(ticketId, { assigned_to_id: value === "" ? null : Number(value) }));
  const [mineOnly, setMineOnly] = useState(false);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const base = mineOnly ? tickets.filter((t) => t.assigned_to === user?.email) : tickets;
    return base.filter((t) =>
      (filter === "all" || t.status === filter) &&
      (!needle || `#${t.id} ${t.title} ${t.description ?? ""} ${t.assigned_to ?? ""}`.toLowerCase().includes(needle)));
  }, [tickets, mineOnly, filter, needle, user?.email]);

  if (loading) return <Loading />;
  if (loadError && !tickets.length) return <ErrorState message={loadError} onRetry={load} />;
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: tickets.filter((t) => t.status === s).length }), {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader
        helpTopic="tickets"
        titleKey="page.tickets.title"
        subtitleKey="page.tickets.sub"
        actions={editable && (
          <button type="button" onClick={() => setShowForm((s) => !s)} className="btn-primary" aria-expanded={showForm}>
            <Plus className="h-4 w-4" /> {showForm ? tr("common.cancel") : tr("tk.new")}
          </button>
        )}
      />

      {/* Bandeau intégration */}
      {config && (
        <div className="card flex items-center gap-3 p-4">
          <span className={cn("grid h-10 w-10 place-items-center rounded-lg", config.provider === "internal" ? "bg-bg-soft text-ink-soft" : "bg-brand/15 text-brand")}>
            <TicketIcon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">
              {tr("tk.provider")} : <span className="uppercase">{config.provider}</span>
              {config.provider !== "internal" && <span className="text-ink-faint"> · {config.target}</span>}
            </p>
            <p className="text-xs text-ink-faint">
              {config.provider === "internal"
                ? tr("tk.internalNote")
                : tr("tk.externalNote")}
            </p>
          </div>
          {config.auto_create && (
            <span className="flex items-center gap-1 rounded-full bg-status-critical/10 px-3 py-1.5 text-xs font-medium text-status-critical">
              <Zap className="h-3.5 w-3.5" /> {tr("tk.autoOnIncident")}
            </span>
          )}
        </div>
      )}

      {showForm && editable && (
        <Card>
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input required aria-label={tr("tk.titleField")} placeholder={tr("tk.titlePh")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input sm:col-span-3" />
            <select aria-label={tr("tk.priorityPrefix")} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
              {Object.entries(PRIO_KEY).map(([k, key]) => <option key={k} value={k}>{tr("tk.priorityPrefix")} : {tr(key)}</option>)}
            </select>
            <textarea aria-label={tr("common.description")} placeholder={tr("tk.descPh")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input sm:col-span-4" rows={2} />
            <button className="btn-primary sm:col-span-4">{tr("tk.createBtn")}</button>
          </form>
        </Card>
      )}

      {/* Recherche et filtres */}
      <SearchInput value={q} onChange={setQ} placeholder={tr("tk.searchPh")} className="max-w-md" />
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("list.statusFilter")}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`${tr("tk.allFilter")} (${tickets.length})`} />
        {STATUSES.map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)} label={`${tr(STATUS_KEY[s])} (${counts[s]})`} color={STATUS_COLOR[s]} />
        ))}
        <Chip
          active={mineOnly}
          onClick={() => setMineOnly((m) => !m)}
          label={`${tr("tk.mine")} (${tickets.filter((t) => t.assigned_to === user?.email).length})`}
          color="rgb(var(--st-maintenance))"
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={TicketIcon} message={tickets.length ? tr("list.noMatch") : tr("tk.empty")} />
      ) : (
        <MotionGrid className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((t) => (
            <motion.div key={t.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
              <div className="card border-l-4 p-4" style={{ borderColor: PRIO_COLOR[t.priority] }}>
                {editing === t.id ? (
                  /* --- Mode édition inline --- */
                  <div className="space-y-2">
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="input w-full font-semibold"
                      aria-label={tr("tk.titleField")}
                      placeholder={tr("tk.titleField")}
                    />
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="input w-full text-xs"
                      rows={6}
                      aria-label={tr("common.description")}
                      placeholder={tr("common.description")}
                    />
                    <div className="flex items-center gap-2">
                      <select aria-label={tr("tk.priorityPrefix")} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} className="input flex-1 text-xs">
                        {Object.entries(PRIO_KEY).map(([k, key]) => <option key={k} value={k}>{tr("tk.priorityPrefix")} : {tr(key)}</option>)}
                      </select>
                      <button type="button" onClick={() => setEditing(null)} className="btn-ghost px-2.5 py-1.5 text-xs"><X className="h-3.5 w-3.5" /> {tr("common.cancel")}</button>
                      <button type="button" onClick={saveEdit} disabled={!draft.title.trim()} className="btn-primary px-2.5 py-1.5 text-xs"><Save className="h-3.5 w-3.5" /> {tr("common.save")}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">#{t.id} · {t.title}</p>
                      {t.description && (
                        <>
                          <p className={cn("mt-0.5 whitespace-pre-wrap text-xs text-ink-soft", !expanded[t.id] && "line-clamp-2")}>
                            {t.description}
                          </p>
                          <button
                            type="button"
                            aria-expanded={!!expanded[t.id]}
                            onClick={() => setExpanded((p) => ({ ...p, [t.id]: !p[t.id] }))}
                            className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-brand hover:underline"
                          >
                            {expanded[t.id] ? <>{tr("tk.collapse")} <ChevronUp className="h-3 w-3" /></> : <>{tr("tk.readAll")} <ChevronDown className="h-3 w-3" /></>}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {editable && (
                        <button type="button" onClick={() => startEdit(t)} className="btn-ghost px-2 py-1" title={tr("tk.editTicket")} aria-label={`${tr("tk.editTicket")} #${t.id}`}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${PRIO_COLOR[t.priority]} 9%, transparent)`, color: PRIO_COLOR[t.priority] }}>
                        {tr(PRIO_KEY[t.priority])}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: `color-mix(in srgb, ${STATUS_COLOR[t.status]} 9%, transparent)`, color: STATUS_COLOR[t.status] }}>
                    {tr(STATUS_KEY[t.status])}
                  </span>
                  {t.assigned_to && (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
                      <UserCheck className="h-3 w-3" /> {t.assigned_to}
                    </span>
                  )}
                  {t.alert_id && <span>· <Link to={`/incidents?open=${t.alert_id}`} className="text-brand hover:underline">{tr("tk.incident")} #{t.alert_id}</Link></span>}
                  {t.created_at && <span>· {timeAgo(t.created_at)}</span>}
                  {t.created_by && <span>· {tr("tk.by")} {t.created_by}</span>}
                  {t.external_id && (
                    t.external_url
                      ? <a href={t.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{t.external_id} <ExternalLink className="h-3 w-3" /></a>
                      : <span className="text-brand">{t.external_id}</span>
                  )}
                </div>
                {/* Tâches (checklist) */}
                <div className="mt-3 rounded-lg border border-border bg-bg-soft/40 p-2.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    <ListChecks className="h-3.5 w-3.5" />
                    {tr("tk.tasks")} {t.tasks.length > 0 && `· ${t.tasks.filter((x) => x.done).length}/${t.tasks.length}`}
                  </p>
                  {t.tasks.length > 0 && (
                    <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-black/30">
                      <div
                        className="h-full rounded-full bg-status-ok transition-all"
                        style={{ width: `${(t.tasks.filter((x) => x.done).length / t.tasks.length) * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    {t.tasks.map((task) => (
                      <div key={task.id} className="group flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={task.done}
                          disabled={!editable}
                          onChange={(e) => toggleTask(task.id, e.target.checked)}
                          aria-label={task.label}
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        <span className={cn("flex-1 text-xs", task.done ? "text-ink-faint line-through" : "text-ink-soft")}>
                          {task.label}
                        </span>
                        {editable && (
                          <button type="button" onClick={() => removeTask(task.id, task.label)} aria-label={`${tr("common.delete")} : ${task.label}`}
                            className="rounded p-0.5 text-ink-faint opacity-60 transition hover:text-status-critical hover:opacity-100 focus-visible:opacity-100">
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        )}
                      </div>
                    ))}
                    {t.tasks.length === 0 && <p className="text-xs text-ink-faint">{tr("tk.noTask")}</p>}
                  </div>
                  {editable && (
                    <form
                      onSubmit={(e) => { e.preventDefault(); addTask(t.id); }}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input
                        value={newTask[t.id] ?? ""}
                        onChange={(e) => setNewTask((p) => ({ ...p, [t.id]: e.target.value }))}
                        placeholder={tr("tk.addTask")}
                        aria-label={tr("tk.addTask")}
                        className="input flex-1 py-1 text-xs"
                      />
                      <button type="submit" className="btn-ghost px-2 py-1" aria-label={tr("tk.addTask")}><Plus className="h-3.5 w-3.5" aria-hidden /></button>
                    </form>
                  )}
                </div>

                {/* Suivis (fil de commentaires) */}
                <div className="mt-3 rounded-lg border border-border bg-bg-soft/40 p-2.5">
                  <button
                    type="button"
                    aria-expanded={!!showComments[t.id]}
                    onClick={() => setShowComments((p) => ({ ...p, [t.id]: !p[t.id] }))}
                    className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> {tr("tk.followups")} {t.comments.length > 0 && `· ${t.comments.length}`}
                    </span>
                    {showComments[t.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showComments[t.id] && (
                    <>
                      <div className="mt-2 space-y-2">
                        {t.comments.map((c) => (
                          <div key={c.id} className="group rounded-lg border border-border bg-bg/60 px-2.5 py-1.5">
                            <div className="flex items-center justify-between text-[11px] text-ink-faint">
                              <span className="font-medium text-ink-soft">{c.author ?? "?"}</span>
                              <span className="flex items-center gap-2">
                                {c.created_at && timeAgo(c.created_at)}
                                {editable && (
                                  <button type="button" onClick={() => removeComment(c.id, c.body)} aria-label={`${tr("common.delete")} : ${tr("tk.followups")}`}
                                    className="rounded p-0.5 opacity-60 transition hover:text-status-critical hover:opacity-100 focus-visible:opacity-100">
                                    <X className="h-3 w-3" aria-hidden />
                                  </button>
                                )}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-soft">{c.body}</p>
                          </div>
                        ))}
                        {t.comments.length === 0 && <p className="text-xs text-ink-faint">{tr("tk.noFollowup")}</p>}
                      </div>
                      {editable && (
                        <form onSubmit={(e) => { e.preventDefault(); postComment(t.id); }} className="mt-2 flex items-end gap-2">
                          <textarea
                            value={newComment[t.id] ?? ""}
                            onChange={(e) => setNewComment((p) => ({ ...p, [t.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                postComment(t.id);
                              }
                            }}
                            rows={1}
                            placeholder={tr("tk.addFollowup")}
                            aria-label={tr("tk.addFollowup")}
                            className="input flex-1 resize-y py-1 text-xs"
                          />
                          <button type="submit" className="btn-ghost px-2 py-1.5" aria-label={tr("tk.send")}><Send className="h-3.5 w-3.5" aria-hidden /></button>
                        </form>
                      )}
                    </>
                  )}
                </div>

                {editable && (
                  <div className="mt-3 flex items-center gap-2">
                    <select aria-label={tr("tk.statusField")} value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)} className="input flex-1 text-xs">
                      {STATUSES.map((s) => <option key={s} value={s}>{tr(STATUS_KEY[s])}</option>)}
                    </select>
                    <select
                      value={t.assigned_to_id ?? ""}
                      onChange={(e) => assign(t.id, e.target.value)}
                      className="input flex-1 text-xs"
                      title={tr("tk.assignTicket")}
                      aria-label={tr("tk.assignTicket")}
                    >
                      <option value="">{tr("tk.unassigned")}</option>
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => remove(t)} className="icon-btn h-8 w-8 hover:text-status-critical" aria-label={`${tr("common.delete")} #${t.id}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </MotionGrid>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-brand bg-brand/15 text-brand" : "border-border text-ink-soft hover:bg-bg-soft")}
      style={active && color ? { borderColor: color, background: `color-mix(in srgb, ${color} 9%, transparent)`, color } : undefined}
    >
      {label}
    </button>
  );
}
