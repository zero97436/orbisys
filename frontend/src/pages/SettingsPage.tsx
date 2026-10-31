import { useEffect, useState } from "react";
import { Mail, Webhook, Plus, Users, Trash2, ShieldAlert, Database, Eraser, MessageSquare, Send, Users2, Hash, Phone, Terminal, KeyRound, ShieldCheck, Pencil, X, Check } from "lucide-react";
import {
  createChannel,
  createUser,
  deleteUser,
  getDbStats,
  listChannels,
  listUsers,
  runRetention,
  testChannel,
  updateUser,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  type DbStats,
  type RoleDef,
  type RoleSection,
} from "../api/endpoints";
import type { NotificationChannel, User } from "../types";

type ChannelType = NotificationChannel["type"];
const CHANNEL_TYPES: ChannelType[] = ["webhook", "email", "slack", "telegram", "teams", "discord", "sms", "script"];
const CHANNEL_PLACEHOLDER: Record<ChannelType, string> = {
  webhook: '{"url": "https://..."}',
  email: '{"to": "ops@exemple.com"}',
  slack: '{"webhook_url": "https://hooks.slack.com/services/..."}',
  telegram: '{"bot_token": "123:ABC", "chat_id": "123456789"}',
  teams: '{"webhook_url": "https://outlook.office.com/webhook/..."}',
  discord: '{"webhook_url": "https://discord.com/api/webhooks/..."}',
  sms: '{"account_sid": "AC...", "auth_token": "...", "from": "+33...", "to": "+33..."}',
  script: '{"command": "/opt/scripts/handler.sh"}',
};
const CHANNEL_ICON: Record<ChannelType, typeof Mail> = {
  email: Mail,
  webhook: Webhook,
  slack: MessageSquare,
  telegram: Send,
  teams: Users2,
  discord: Hash,
  sms: Phone,
  script: Terminal,
};
import { formatDate } from "../lib/format";
import { PageHeader } from "../components/ui/PageHeader";
import { BrandingPanel } from "../components/BrandingPanel";
import { LicenseCard } from "../components/LicenseCard";
import { Card, SectionTitle } from "../components/ui/Card";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { SystemHealthCard } from "../components/SystemHealthCard";
import { changePassword } from "../api/endpoints";
import { useAuth } from "../lib/auth";
import { isAdmin } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";

const EMPTY_CHANNEL = { name: "", type: "webhook" as ChannelType, config_json: '{"url": ""}', escalation_only: false, active_hours: "" };
const EMPTY_USER = { email: "", password: "", role: "viewer" };
const BUILTIN_ROLE_KEY: Record<string, string> = { admin: "role.admin", operator: "role.operator", viewer: "role.viewer" };

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const admin = isAdmin(user);
  const dispRole = (name: string) => (BUILTIN_ROLE_KEY[name] ? t(BUILTIN_ROLE_KEY[name]) : name);

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chForm, setChForm] = useState(EMPTY_CHANNEL);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [sections, setSections] = useState<RoleSection[]>([]);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [userConfirm, setUserConfirm] = useState("");
  const [userErr, setUserErr] = useState<string | null>(null);

  const [stats, setStats] = useState<DbStats | null>(null);
  const [purging, setPurging] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const load = () => {
    setLoading(true);
    listChannels()
      .then((r) => setChannels(r.data))
      .catch(() => setError(t("common.loadError")))
      .finally(() => setLoading(false));
    if (admin) {
      listUsers().then((r) => setUsers(r.data)).catch(() => {});
      getDbStats().then((r) => setStats(r.data)).catch(() => {});
      loadRoles();
    }
  };

  const loadRoles = () =>
    listRoles()
      .then((r) => { setRoles(r.data.roles); setSections(r.data.sections); })
      .catch(() => {});
  useEffect(load, [admin]);

  // Suppression définitive : confirmation explicite, mot à retaper, fenêtres affichées.
  const purge = async () => {
    if (!stats) return;
    const d = stats.retention_days;
    const ok = await confirm({
      title: t("set.purgeTitle"),
      message: <><p>{t("set.purgeBody")}</p><p className="mt-2 font-medium text-status-critical">{t("confirm.irreversible")}</p></>,
      details: [
        `${t("set.ret.checkResults")} > ${d.check_results} ${t("set.daysShort")}`,
        `${t("set.ret.metricsRaw")} > ${d.host_metrics} ${t("set.daysShort")}`,
        `${t("set.ret.metricsHourly")} > ${d.host_metrics_hourly} ${t("set.daysShort")}`,
        `${t("set.ret.alerts")} > ${d.resolved_alerts} ${t("set.daysShort")}`,
      ].map((l) => <div key={l}>{l}</div>),
      requireText: t("set.purgeWord"),
      confirmLabel: t("set.purgeNow"),
      tone: "danger",
    });
    if (!ok) return;
    setPurging(true);
    try {
      const { data } = await runRetention();
      toast.success(`${t("set.purgeDone")} : ${data.total} ${t("set.rowsDeleted")}`);
      getDbStats().then((r) => setStats(r.data)).catch(() => {});
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setPurging(false);
    }
  };

  const submitChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(chForm.config_json || "{}");
    } catch {
      toast.error(t("set.badJson"));
      return;
    }
    try {
      await createChannel({
        name: chForm.name, type: chForm.type, config_json: config,
        escalation_only: chForm.escalation_only, active_hours: chForm.active_hours || null,
      });
      toast.success(t("common.saved"));
      setChForm(EMPTY_CHANNEL);
    } catch (err) {
      // 403 = canal réservé à une édition supérieure : message explicite du serveur.
      toast.error(apiErrorMessage(err, t("common.actionFailed")));
    }
    load();
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErr(null);
    if (userForm.password !== userConfirm) {
      setUserErr(t("set.pwMismatch"));
      return;
    }
    try {
      await createUser(userForm);
      setUserForm(EMPTY_USER);
      setUserConfirm("");
      load();
    } catch (err) {
      setUserErr(apiErrorMessage(err, t("set.createUserFail")));
    }
  };

  const testCh = async (id: number) => {
    try {
      await testChannel(id);
      toast.success(t("set.testSent"));
    } catch (err) {
      toast.error(apiErrorMessage(err, t("set.testFail")));
    }
  };

  const changeRole = async (u: User, role: string) => {
    try {
      await updateUser(u.id, { role });
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
    load();
  };

  const removeUser = async (u: User) => {
    const ok = await confirm({ title: `${t("set.confirmDeleteUser")} ?`, details: u.email, confirmLabel: t("common.delete"), tone: "danger" });
    if (!ok) return;
    try {
      await deleteUser(u.id);
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader titleKey="page.settings.title" subtitleKey="page.settings.sub" />

      <AccountCard />

      <LicenseCard />

      {/* Image de marque : modification réservée aux administrateurs (contrôle backend identique). */}
      {admin && <BrandingPanel />}

      {admin && <SystemHealthCard />}

      {/* Gestion des utilisateurs (admin) */}
      {admin && (
        <Card>
          <SectionTitle title={t("set.usersRoles")} icon={Users} />
          <form onSubmit={submitUser} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <input required type="email" placeholder="Email" value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="input" />
            <input required type="password" placeholder={t("set.pwMin")} value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="input" />
            <input required type="password" placeholder={t("set.pwConfirm")} value={userConfirm}
              onChange={(e) => setUserConfirm(e.target.value)}
              className={`input ${userConfirm && userForm.password !== userConfirm ? "ring-1 ring-status-critical" : ""}`} />
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="input">
              {roles.map((r) => <option key={r.name} value={r.name}>{dispRole(r.name)}</option>)}
            </select>
            <button className="btn-primary"><Plus className="h-4 w-4" /> {t("common.add")}</button>
          </form>
          {userErr && <p className="mb-3 text-sm text-status-critical">{userErr}</p>}

          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{u.email}</p>
                  <p className="text-xs text-ink-faint">{u.is_active ? t("common.active") : t("common.inactive")}</p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u, e.target.value)}
                  disabled={u.id === user?.id}
                  className="input py-1.5 text-xs"
                  title={u.id === user?.id ? t("set.ownRole") : undefined}
                >
                  {roles.map((r) => <option key={r.name} value={r.name}>{dispRole(r.name)}</option>)}
                </select>
                {u.id !== user?.id && (
                  <button onClick={() => removeUser(u)} className="text-status-critical/80 hover:text-status-critical">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rôles personnalisés (admin) */}
      {admin && <RolesCard roles={roles} sections={sections} onChange={loadRoles} />}

      {/* Maintenance / rétention (admin) */}
      {admin && stats && (
        <Card>
          <SectionTitle
            title={t("set.dbRetention")}
            icon={Database}
            action={
              <button type="button" onClick={purge} disabled={purging} className="btn-ghost px-3 py-1.5 text-xs hover:text-status-critical">
                <Eraser className="h-3.5 w-3.5" aria-hidden /> {purging ? t("set.purging") : t("set.purgeNow")}
              </button>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RetentionStat label={t("set.ret.checkResults")} stat={stats.check_results} days={stats.retention_days.check_results} />
            <RetentionStat label={t("set.ret.metricsRaw")} stat={stats.host_metrics} days={stats.retention_days.host_metrics} />
            <RetentionStat label={t("set.ret.metricsHourly")} stat={stats.host_metrics_hourly} days={stats.retention_days.host_metrics_hourly} />
            <RetentionStat label={t("set.ret.alerts")} stat={stats.alerts} days={stats.retention_days.resolved_alerts} />
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            {t("set.retentionNote")}
          </p>
        </Card>
      )}

      {/* Canaux de notification */}
      <Card>
        <SectionTitle title={t("set.channels")} />
        {admin ? (
          <form onSubmit={submitChannel} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input required placeholder="Nom" value={chForm.name} onChange={(e) => setChForm({ ...chForm, name: e.target.value })} className="input" />
            <select
              value={chForm.type}
              onChange={(e) => {
                const ct = e.target.value as ChannelType;
                setChForm({ ...chForm, type: ct, config_json: CHANNEL_PLACEHOLDER[ct] });
              }}
              className="input"
            >
              {CHANNEL_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
            <input placeholder={CHANNEL_PLACEHOLDER[chForm.type]} value={chForm.config_json} onChange={(e) => setChForm({ ...chForm, config_json: e.target.value })} className="input font-mono" />
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={chForm.escalation_only} onChange={(e) => setChForm({ ...chForm, escalation_only: e.target.checked })} />
              {t("set.escalationOnly")}
            </label>
            <input placeholder={t("set.activeHoursPh")} value={chForm.active_hours} onChange={(e) => setChForm({ ...chForm, active_hours: e.target.value })} className="input sm:col-span-2" />
            <button className="btn-primary sm:col-span-3"><Plus className="h-4 w-4" /> {t("set.addChannel")}</button>
          </form>
        ) : (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-soft/50 p-3 text-sm text-ink-faint">
            <ShieldAlert className="h-4 w-4" /> {t("set.adminOnlyChannels")}
          </p>
        )}

        {loading ? <Loading /> : error ? <ErrorState message={error} /> :
          channels.length === 0 ? <EmptyState message={t("set.noChannels")} /> : (
          <div className="space-y-2">
            {channels.map((ch) => {
              const Icon = CHANNEL_ICON[ch.type] ?? Webhook;
              return (
                <div key={ch.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2.5">
                  <span className="rounded-lg bg-bg p-2 text-ink-soft">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {ch.name}
                      {ch.escalation_only && <span className="rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] text-status-warning">{t("set.onCall")}</span>}
                      {ch.active_hours && <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-ink-faint">{ch.active_hours}</span>}
                    </p>
                    <p className="truncate font-mono text-xs text-ink-faint">{JSON.stringify(ch.config_json)}</p>
                  </div>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-ink-soft">{ch.type}</span>
                  {admin && (
                    <button onClick={() => testCh(ch.id)} className="btn-ghost px-2.5 py-1.5 text-xs">
                      <Send className="h-3.5 w-3.5" /> {t("common.test")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-sm text-ink-faint">
        {t("set.smtpNote")}
      </p>
    </div>
  );
}

function RetentionStat({
  label,
  stat,
  days,
}: {
  label: string;
  stat: { count: number; oldest: string | null };
  days: number;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-bg-soft/50 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stat.count.toLocaleString()}</p>
      <p className="mt-1 text-xs text-ink-faint">
        {t("set.retentionWord")} {days} {t("set.daysShort")} · {t("set.oldest")} : {stat.oldest ? formatDate(stat.oldest) : "—"}
      </p>
    </div>
  );
}

function AccountCard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw !== confirm) { setMsg({ ok: false, text: t("acc.pwMismatch") }); return; }
    if (pw.length < 6) { setMsg({ ok: false, text: t("acc.pwTooShort") }); return; }
    setBusy(true);
    try {
      await changePassword(cur, pw);
      setMsg({ ok: true, text: t("acc.pwChanged") });
      setCur(""); setPw(""); setConfirm("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg({ ok: false, text: detail ?? t("acc.changeFail") });
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <SectionTitle title={t("acc.title")} icon={KeyRound} />
      <p className="mb-3 text-xs text-ink-faint">{t("acc.connectedAs")} <b className="text-ink-soft">{user?.email}</b> ({user?.role}).</p>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input required type="password" placeholder={t("acc.currentPw")} value={cur} onChange={(e) => setCur(e.target.value)} className="input" autoComplete="current-password" />
        <input required type="password" placeholder={t("acc.newPw")} value={pw} onChange={(e) => setPw(e.target.value)} className="input" autoComplete="new-password" />
        <input required type="password" placeholder={t("acc.confirmNew")} value={confirm} onChange={(e) => setConfirm(e.target.value)}
               className={`input ${confirm && pw !== confirm ? "ring-1 ring-status-critical" : ""}`} autoComplete="new-password" />
        <button disabled={busy} className="btn-primary sm:col-span-3">{t("acc.changeMyPw")}</button>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-status-ok" : "text-status-critical"}`}>{msg.text}</p>}
    </Card>
  );
}

// --- Rôles personnalisés : droits de modification par section ---
function RolesCard({ roles, sections, onChange }: { roles: RoleDef[]; sections: RoleSection[]; onChange: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleDef | null>(null);

  const toggle = (key: string) =>
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (editing) {
        await updateRole(editing.id!, { description: desc, permissions: perms });
      } else {
        await createRole({ name, description: desc, permissions: perms });
      }
      setName(""); setDesc(""); setPerms([]); setEditing(null);
      onChange();
    } catch (e2: unknown) {
      const detail = (e2 as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail ?? t("roles.saveFail"));
    }
  };

  const startEdit = (r: RoleDef) => {
    setEditing(r); setName(r.name); setDesc(r.description ?? ""); setPerms(r.permissions); setErr(null);
  };
  const cancel = () => { setEditing(null); setName(""); setDesc(""); setPerms([]); setErr(null); };

  const confirmDialog = useConfirm();
  const remove = async (r: RoleDef) => {
    const ok = await confirmDialog({
      title: `${t("roles.confirmDelete")} ?`,
      message: t("roles.confirmDeleteTail").replace(/^\?\s*/, ""),
      details: r.name,
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteRole(r.id!);
    } catch (e) {
      setErr(apiErrorMessage(e, t("roles.saveFail")));
    }
    onChange();
  };

  const custom = roles.filter((r) => !r.builtin);

  return (
    <Card>
      <SectionTitle title={t("roles.title")} icon={ShieldCheck} />
      <p className="mb-3 text-xs text-ink-faint">
        {t("roles.intro")}
      </p>

      <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border bg-bg-soft/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input required placeholder={t("roles.namePh")} value={name}
            disabled={!!editing}
            onChange={(e) => setName(e.target.value)} className="input" />
          <input placeholder={t("roles.descPh")} value={desc}
            onChange={(e) => setDesc(e.target.value)} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sections.map((s) => (
            <label key={s.key} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${perms.includes(s.key) ? "border-brand/50 bg-brand/10 text-ink" : "border-border text-ink-soft"}`}>
              <input type="checkbox" checked={perms.includes(s.key)} onChange={() => toggle(s.key)} className="accent-brand" />
              {s.label}
            </label>
          ))}
        </div>
        {err && <p className="text-sm text-status-critical">{err}</p>}
        <div className="flex gap-2">
          <button className="btn-primary">
            {editing ? <><Check className="h-4 w-4" /> {t("common.save")}</> : <><Plus className="h-4 w-4" /> {t("roles.createRole")}</>}
          </button>
          {editing && <button type="button" onClick={cancel} className="btn-ghost"><X className="h-4 w-4" /> {t("common.cancel")}</button>}
        </div>
      </form>

      {custom.length === 0 ? (
        <p className="text-sm text-ink-faint">{t("roles.none")}</p>
      ) : (
        <div className="space-y-2">
          {custom.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border border-border bg-bg-soft/50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{r.name}</p>
                {r.description && <p className="text-xs text-ink-faint">{r.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.permissions.length === 0
                    ? <span className="text-xs text-ink-faint">{t("roles.readOnly")}</span>
                    : r.permissions.map((p) => {
                        const lbl = sections.find((s) => s.key === p)?.label ?? p;
                        return <span key={p} className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand">{lbl}</span>;
                      })}
                </div>
              </div>
              <button onClick={() => startEdit(r)} className="text-ink-soft hover:text-ink" title={t("common.edit")}><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(r)} className="text-status-critical/80 hover:text-status-critical" title={t("common.delete")}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
