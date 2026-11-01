import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutTemplate, Trash2, Copy, Zap, CheckCircle2 } from "lucide-react";
import {
  listCheckTemplates, createTemplateFromHost, applyCheckTemplate, deleteCheckTemplate, listHosts,
  type CheckTemplate,
} from "../api/endpoints";
import type { Host } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, MotionGrid, SectionTitle } from "../components/ui/Card";
import { Loading } from "../components/States";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";


export default function TemplatesPage() {
  const { t: tr } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const { user } = useAuth();
  const editable = canEdit(user);
  const [templates, setTemplates] = useState<CheckTemplate[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [capture, setCapture] = useState({ host_id: 0, name: "" });

  const load = () => {
    Promise.all([listCheckTemplates(), listHosts()])
      .then(([t, h]) => { setTemplates(t.data); setHosts(h.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const apply = async (tplId: number) => {
    const hostId = targets[tplId];
    if (!hostId) return;
    const { data } = await applyCheckTemplate(tplId, hostId);
    const host = hosts.find((h) => h.id === hostId);
    setFeedback((p) => ({
      ...p,
      [tplId]: `✅ ${data.created.length} ${tr("tpl.checksCreated")} ${host?.name}` +
        (data.skipped.length ? ` · ${data.skipped.length} ${tr("tpl.alreadyPresent")}` : ""),
    }));
  };

  const captureHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capture.host_id || !capture.name.trim()) return;
    await createTemplateFromHost(capture.host_id, capture.name.trim());
    setCapture({ host_id: 0, name: "" });
    load();
  };

  const remove = async (id: number, name: string) => {
    if (!(await confirm({ title: tr("tpl.confirmDelete"), details: name, confirmLabel: tr("common.delete"), tone: "danger" }))) return;
    try { await deleteCheckTemplate(id); } catch (e) { toast.error(apiErrorMessage(e, tr("common.actionFailed"))); }
    load();
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        helpTopic="templates"
        titleKey="page.templates.title"
        subtitleKey="page.templates.sub"
      />

      {/* Capturer un hôte existant en modèle */}
      {editable && (
        <Card>
          <SectionTitle title={tr("tpl.createFromHost")} icon={Copy} />
          <form onSubmit={captureHost} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={capture.host_id}
              onChange={(e) => setCapture({ ...capture, host_id: Number(e.target.value) })}
              className="input" required aria-label={tr("tpl.chooseSource")}
            >
              <option value={0}>{tr("tpl.chooseSource")}</option>
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <input
              required placeholder={tr("tpl.namePh")}
              value={capture.name}
              onChange={(e) => setCapture({ ...capture, name: e.target.value })}
              className="input"
            />
            <button className="btn-primary">{tr("tpl.capture")}</button>
          </form>
          <p className="mt-2 text-xs text-ink-faint">{tr("tpl.captureNote")}</p>
        </Card>
      )}

      <MotionGrid className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {templates.map((t) => (
          <motion.div key={t.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
            <div className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{t.name}</p>
                    {t.description && <p className="truncate text-xs text-ink-faint">{t.description}</p>}
                  </div>
                </div>
                {editable && (
                  <button type="button" onClick={() => remove(t.id, t.name)} className="icon-btn h-8 w-8 hover:text-status-critical" aria-label={`${tr("common.delete")} ${t.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Checks du modèle */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.items.map((it, i) => (
                  <span key={i} className="rounded-full border border-border bg-bg-soft px-2.5 py-1 text-[11px] text-ink-soft" title={JSON.stringify(it.config_json ?? {})}>
                    {it.name} <span className="text-ink-faint">({it.type})</span>
                  </span>
                ))}
              </div>

              {/* Appliquer */}
              {editable && (
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={targets[t.id] ?? 0}
                    onChange={(e) => setTargets((p) => ({ ...p, [t.id]: Number(e.target.value) }))}
                    className="input flex-1 text-xs" aria-label={`${tr("tpl.applyTo")} : ${t.name}`}
                  >
                    <option value={0}>{tr("tpl.applyTo")}</option>
                    {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <button onClick={() => apply(t.id)} disabled={!targets[t.id]} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">
                    <Zap className="h-3.5 w-3.5" /> {tr("tpl.apply")}
                  </button>
                </div>
              )}
              {feedback[t.id] && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-status-ok">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {feedback[t.id]}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </MotionGrid>
    </div>
  );
}
