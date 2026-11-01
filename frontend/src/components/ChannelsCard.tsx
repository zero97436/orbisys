import { useEffect, useId, useState } from "react";
import { Bell, Loader2, Mail, MessageSquare, Plus, Send, ShieldAlert, Smartphone, Terminal, Trash2, Webhook } from "lucide-react";
import { createChannel, deleteChannel, listChannels, testChannel } from "../api/endpoints";
import type { NotificationChannel } from "../types";

type ChannelType = NotificationChannel["type"];
import { Card, SectionTitle } from "./ui/Card";
import { PlanTag } from "./ui/UpgradeNotice";
import { useConfirm } from "./ui/Confirm";
import { useToast } from "./ui/Toast";
import { EmptyState, ErrorState, Loading } from "./States";
import { useLicense } from "../lib/license";
import { apiErrorMessage } from "../lib/apiError";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

interface FieldDef { key: string; kind: "url" | "email" | "text" | "secret" | "phone"; placeholder: string }

/** Paramètres de chaque type de canal (mêmes clés que les notifiers du backend). */
const FIELDS: Record<ChannelType, FieldDef[]> = {
  webhook: [{ key: "url", kind: "url", placeholder: "https://…" }],
  email: [{ key: "to", kind: "email", placeholder: "ops@exemple.com" }],
  slack: [{ key: "webhook_url", kind: "secret", placeholder: "https://hooks.slack.com/services/…" }],
  telegram: [{ key: "bot_token", kind: "secret", placeholder: "123456:ABC…" }, { key: "chat_id", kind: "text", placeholder: "123456789" }],
  teams: [{ key: "webhook_url", kind: "secret", placeholder: "https://…webhook.office.com/…" }],
  discord: [{ key: "webhook_url", kind: "secret", placeholder: "https://discord.com/api/webhooks/…" }],
  sms: [
    { key: "account_sid", kind: "text", placeholder: "AC…" }, { key: "auth_token", kind: "secret", placeholder: "" },
    { key: "from", kind: "phone", placeholder: "+33…" }, { key: "to", kind: "phone", placeholder: "+33…" },
  ],
  script: [{ key: "command", kind: "text", placeholder: "/opt/scripts/handler.sh" }],
};
const TYPES = Object.keys(FIELDS) as ChannelType[];
/** Canaux inclus en Community ; les autres nécessitent « advanced_channels ». */
const COMMUNITY: ChannelType[] = ["email", "webhook"];
const ICON: Record<ChannelType, typeof Mail> = {
  email: Mail, webhook: Webhook, slack: MessageSquare, telegram: Send, teams: MessageSquare, discord: MessageSquare, sms: Smartphone, script: Terminal,
};
const HOURS = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function fieldError(f: FieldDef, v: string, t: (k: string) => string): string | null {
  if (!v.trim()) return t("ch.required");
  if ((f.kind === "url" || (f.kind === "secret" && f.key === "webhook_url")) && !/^https?:\/\/\S+$/.test(v.trim())) return t("ch.badUrl");
  if (f.kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())) return t("ch.badEmail");
  if (f.kind === "phone" && !/^\+?[0-9 ]{6,}$/.test(v.trim())) return t("ch.badPhone");
  return null;
}

/** Canaux de notification (administrateurs). Les secrets ne sont jamais réaffichés :
 *  le backend les renvoie masqués (********). */
export function ChannelsCard({ admin }: { admin: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { has, loading: licLoading } = useLicense();
  const advanced = licLoading || has("advanced_channels");
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  const [channels, setChannels] = useState<NotificationChannel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ChannelType>("email");
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [escalationOnly, setEscalationOnly] = useState(false);
  const [hours, setHours] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);

  const load = () => listChannels().then((r) => { setChannels(r.data); setError(null); }).catch(() => setError(t("common.loadError")));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = FIELDS[type];
  const errors = Object.fromEntries(fields.map((f) => [f.key, fieldError(f, values[f.key] ?? "", t)]));
  const hoursErr = hours && !HOURS.test(hours.trim()) ? t("ch.badHours") : null;
  const nameErr = name.trim() ? null : t("ch.required");
  const locked = !COMMUNITY.includes(type) && !advanced;
  const invalid = !!nameErr || !!hoursErr || Object.values(errors).some(Boolean) || locked;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    try {
      await createChannel({
        name: name.trim(), type,
        config_json: Object.fromEntries(fields.map((f) => [f.key, (values[f.key] ?? "").trim()])),
        escalation_only: escalationOnly, active_hours: hours.trim() || null,
      });
      toast.success(t("ch.created"));
      setName(""); setValues({}); setEscalationOnly(false); setHours(""); setTouched(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("common.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const test = async (ch: NotificationChannel) => {
    setTesting(ch.id);
    try {
      await testChannel(ch.id);
      toast.success(t("ch.testOk").replace("{name}", ch.name));
    } catch (err) {
      toast.error(apiErrorMessage(err, t("set.testFail")));
    } finally {
      setTesting(null);
    }
  };

  const remove = async (ch: NotificationChannel) => {
    const ok = await confirm({ title: t("ch.deleteTitle"), message: t("ch.deleteBody"), details: `${ch.name} · ${t(`ch.type.${ch.type}`)}`, confirmLabel: t("common.delete"), tone: "danger" });
    if (!ok) return;
    try {
      await deleteChannel(ch.id);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("common.actionFailed")));
    }
  };

  const show = (e: string | null) => (touched ? e : null);

  return (
    <Card id="channels">
      <SectionTitle title={t("set.channels")} icon={Bell} />
      {admin ? (
        <form onSubmit={submit} noValidate className="mb-6 space-y-3 rounded-lg border border-border bg-bg-soft/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={id("type")}>{t("ch.typeLabel")}</label>
              <select id={id("type")} className="input w-full" value={type} onChange={(e) => { setType(e.target.value as ChannelType); setValues({}); }}>
                {TYPES.map((ct) => (
                  <option key={ct} value={ct}>{t(`ch.type.${ct}`)}{!COMMUNITY.includes(ct) && !advanced ? ` — ${t("license.requires")} Professional` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={id("name")}>{t("common.name")}</label>
              <input id={id("name")} className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ch.namePh")} aria-invalid={!!show(nameErr)} />
              {show(nameErr) && <p className="field-error">{nameErr}</p>}
            </div>
          </div>

          {locked ? (
            <p className="flex items-center gap-2 text-sm text-ink-soft"><PlanTag feature="advanced_channels" /> {t("ch.lockedHint")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={id(f.key)}>{t(`ch.f.${f.key}`)}</label>
                  <input id={id(f.key)} className="input w-full font-mono" type={f.kind === "secret" ? "password" : f.kind === "email" ? "email" : "text"}
                    autoComplete={f.kind === "secret" ? "new-password" : "off"} spellCheck={false} placeholder={f.placeholder}
                    value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} aria-invalid={!!show(errors[f.key])} />
                  {show(errors[f.key]) ? <p className="field-error">{errors[f.key]}</p> : f.kind === "secret" && <p className="field-hint">{t("ch.secretHint")}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={id("hours")}>{t("ch.hours")}</label>
              <input id={id("hours")} className="input w-full font-mono" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="08:00-20:00" aria-invalid={!!hoursErr} />
              {hoursErr ? <p className="field-error">{hoursErr}</p> : <p className="field-hint">{t("ch.hoursHint")}</p>}
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="h-4 w-4" checked={escalationOnly} onChange={(e) => setEscalationOnly(e.target.checked)} />
              {t("set.escalationOnly")}
            </label>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy || locked}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} {t("set.addChannel")}
          </button>
        </form>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-soft/50 p-3 text-sm text-ink-faint">
          <ShieldAlert className="h-4 w-4" aria-hidden /> {t("set.adminOnlyChannels")}
        </p>
      )}

      {channels === null && !error ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> :
        channels!.length === 0 ? <EmptyState icon={Bell} message={t("set.noChannels")} /> : (
        <ul className="space-y-2">
          {channels!.map((ch) => {
            const Icon = ICON[ch.type] ?? Webhook;
            // Résumé lisible : valeurs non secrètes en clair, secrets masqués par le backend.
            const summary = Object.entries(ch.config_json ?? {}).map(([k, v]) => `${t(`ch.f.${k}`) === `ch.f.${k}` ? k : t(`ch.f.${k}`)} : ${String(v)}`).join(" · ");
            return (
              <li key={ch.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2.5">
                <span className="rounded-lg bg-bg p-2 text-ink-soft"><Icon className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {ch.name}
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] text-ink-soft">{t(`ch.type.${ch.type}`)}</span>
                    {ch.escalation_only && <span className="rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] text-status-warning">{t("set.onCall")}</span>}
                    {ch.active_hours && <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">{ch.active_hours}</span>}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-faint" title={summary}>{summary}</p>
                </div>
                {admin && (
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => test(ch)} disabled={testing !== null} className={cn("btn-ghost btn-sm")}>
                      {testing === ch.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />} {t("ch.sendTest")}
                    </button>
                    <button type="button" onClick={() => remove(ch)} className="icon-btn h-8 w-8 hover:text-status-critical" aria-label={`${t("common.delete")} ${ch.name}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
