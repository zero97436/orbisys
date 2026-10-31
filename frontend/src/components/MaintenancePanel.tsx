import { useEffect, useId, useState } from "react";
import { Wrench, Plus, Trash2, Loader2 } from "lucide-react";
import { createMaintenance, deleteMaintenance, listHosts, listMaintenances } from "../api/endpoints";
import type { Host, Maintenance } from "../types";
import { Card, SectionTitle } from "./ui/Card";
import { useConfirm } from "./ui/Confirm";
import { useToast } from "./ui/Toast";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { formatDate } from "../lib/format";
import { apiErrorMessage } from "../lib/apiError";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

const EMPTY = { host_id: 0, reason: "", starts_at: "", ends_at: "" };
type Phase = "active" | "scheduled" | "ended";

/** Fenêtres de maintenance : pendant une fenêtre active, les checks tournent mais aucune
 *  alerte n'est ouverte ni notifiée (comportement backend inchangé). */
export function MaintenancePanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const editable = canEdit(user);
  const uid = useId();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const load = () => {
    listMaintenances().then((r) => setItems(r.data)).catch(() => toast.error(t("common.loadError")));
    listHosts().then((r) => setHosts(r.data)).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hostName = new Map(hosts.map((h) => [h.id, h.name]));
  const phase = (m: Maintenance): Phase => {
    const now = Date.now();
    if (new Date(m.ends_at).getTime() < now) return "ended";
    return new Date(m.starts_at).getTime() <= now ? "active" : "scheduled";
  };
  const order: Record<Phase, number> = { active: 0, scheduled: 1, ended: 2 };
  const sorted = [...items].sort((a, b) => order[phase(a)] - order[phase(b)] || +new Date(a.starts_at) - +new Date(b.starts_at));

  const rangeError = form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at) ? t("mnt.endAfterStart") : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.starts_at || !form.ends_at || rangeError) return;
    setBusy(true);
    try {
      await createMaintenance({
        host_id: form.host_id || null,
        reason: form.reason || undefined,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
      });
      toast.success(t("mnt.created"));
      setForm(EMPTY);
      setShow(false);
      setTouched(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("common.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Maintenance) => {
    const target = m.host_id ? `${t("mnt.hostPrefix")} : ${hostName.get(m.host_id) ?? m.host_id}` : t("mnt.global");
    const ok = await confirm({
      title: t("mnt.confirmDelete"),
      message: phase(m) === "active" ? t("mnt.deleteActive") : undefined,
      details: `${target} · ${formatDate(m.starts_at)} → ${formatDate(m.ends_at)}`,
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteMaintenance(m.id);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("common.actionFailed")));
    }
  };

  const id = (k: string) => `${uid}-${k}`;
  const visible = compact ? sorted.filter((m) => phase(m) !== "ended") : sorted;

  return (
    <Card>
      <SectionTitle
        title={t("mnt.title")}
        icon={Wrench}
        action={editable && (
          <button type="button" onClick={() => setShow((s) => !s)} className="btn-ghost btn-sm" aria-expanded={show}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> {show ? t("common.cancel") : t("mnt.schedule")}
          </button>
        )}
      />

      {show && editable && (
        <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-bg-soft/40 p-3 sm:grid-cols-2" noValidate>
          <div>
            <label className="label" htmlFor={id("target")}>{t("mnt.target")}</label>
            <select id={id("target")} value={form.host_id} onChange={(e) => setForm({ ...form, host_id: Number(e.target.value) })} className="input w-full">
              <option value={0}>{t("mnt.wholePlatform")}</option>
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={id("reason")}>{t("mnt.reason")}</label>
            <input id={id("reason")} placeholder={t("mnt.reasonPh")} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="label" htmlFor={id("start")}>{t("mnt.start")}</label>
            <input id={id("start")} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className="input w-full" aria-invalid={touched && !form.starts_at} />
          </div>
          <div>
            <label className="label" htmlFor={id("end")}>{t("mnt.end")}</label>
            <input id={id("end")} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="input w-full" aria-invalid={!!rangeError || (touched && !form.ends_at)} />
            {rangeError && <p className="field-error">{rangeError}</p>}
            {touched && (!form.starts_at || !form.ends_at) && !rangeError && <p className="field-error">{t("mnt.datesRequired")}</p>}
          </div>
          <button type="submit" className="btn-primary sm:col-span-2" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {t("mnt.scheduleBtn")}
          </button>
        </form>
      )}

      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">{t("mnt.none")}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => {
            const ph = phase(m);
            return (
              <li key={m.id} className={cn("flex items-center gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2.5", ph === "ended" && "opacity-60")}>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  ph === "active" ? "bg-status-maintenance/15 text-status-maintenance" : "bg-bg text-ink-faint")}>
                  <Wrench className="h-3 w-3" aria-hidden /> {t(`mnt.phase.${ph}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {m.host_id ? `${t("mnt.hostPrefix")} : ${hostName.get(m.host_id) ?? m.host_id}` : t("mnt.global")}
                    {m.reason ? ` — ${m.reason}` : ""}
                  </p>
                  <p className="text-xs text-ink-faint">{formatDate(m.starts_at)} → {formatDate(m.ends_at)}{m.created_by ? ` · ${m.created_by}` : ""}</p>
                </div>
                {editable && (
                  <button type="button" onClick={() => remove(m)} className="icon-btn h-8 w-8 hover:text-status-critical" aria-label={`${t("common.delete")} : ${t("mnt.title")} #${m.id}`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-faint">{t("mnt.note")}</p>
    </Card>
  );
}
