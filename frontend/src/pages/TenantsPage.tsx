import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Server, Users } from "lucide-react";
import {
  listTenants, createTenant, deleteTenant, assignHostTenant, assignUserTenant,
  listHosts, listUsers, type Tenant,
} from "../api/endpoints";
import type { Host, User } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, SectionTitle, MotionGrid } from "../components/ui/Card";
import { Loading } from "../components/States";
import { useI18n } from "../lib/i18n";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { apiErrorMessage } from "../lib/apiError";


export default function TenantsPage() {
  const { t: tr } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessOnly, setBusinessOnly] = useState(false);
  const [name, setName] = useState("");

  const load = () =>
    Promise.all([listTenants(), listHosts(), listUsers()])
      .then(([t, h, u]) => { setTenants(t.data); setHosts(h.data); setUsers(u.data); setBusinessOnly(false); })
      .catch((e) => { if (e?.response?.status === 403) setBusinessOnly(true); });

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createTenant(name.trim());
    setName("");
    load();
  };
  const remove = async (id: number, name: string) => {
    if (!(await confirm({ title: tr("ten.confirmDelete"), message: tr("ten.deleteBody"), details: name, confirmLabel: tr("common.delete"), tone: "danger" }))) return;
    try { await deleteTenant(id); } catch (e) { toast.error(apiErrorMessage(e, tr("common.actionFailed"))); }
    load();
  };
  const setHost = async (host_id: number, tenant_id: number) => {
    await assignHostTenant(host_id, tenant_id || null); load();
  };
  const setUser = async (user_id: number, tenant_id: number) => {
    await assignUserTenant(user_id, tenant_id || null); load();
  };

  if (loading) return <Loading />;

  if (businessOnly) {
    return (
      <div className="space-y-6">
        <PageHeader titleKey="page.tenants.title" subtitleKey="page.tenants.sub" />
        <Card>
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2 className="h-12 w-12 text-ink-faint" />
            <p className="text-sm font-medium text-ink">{tr("ten.businessTitle")}</p>
            <p className="max-w-md text-xs text-ink-faint">{tr("ten.businessDesc")}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader titleKey="page.tenants.title" subtitleKey="page.tenants.sub" helpTopic="tenants" />

      <Card>
        <SectionTitle title={tr("ten.createTenant")} icon={Plus} />
        <form onSubmit={create} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("ten.namePh")} className="input flex-1" />
          <button className="btn-primary">{tr("common.create")}</button>
        </form>
      </Card>

      <MotionGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand"><Building2 className="h-4 w-4" /></span>
                <div>
                  <p className="font-semibold text-ink">{t.name}</p>
                  <p className="text-xs text-ink-faint">{t.slug}</p>
                </div>
              </div>
              <button type="button" onClick={() => remove(t.id, t.name)} className="icon-btn h-8 w-8 hover:text-status-critical" aria-label={`${tr("common.delete")} ${t.name}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1"><Server className="h-3.5 w-3.5" /> {t.hosts} {tr("ten.hostsCount")}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.users} {tr("ten.usersCount")}</span>
            </div>
          </div>
        ))}
        {tenants.length === 0 && <p className="text-sm text-ink-faint">{tr("ten.none")}</p>}
      </MotionGrid>

      {/* Assignation des hôtes */}
      <Card className="overflow-hidden p-0">
        <div className="p-5 pb-2"><SectionTitle title={tr("ten.assignHosts")} icon={Server} /></div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-bg-soft/50 text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr><th className="px-4 py-2.5">{tr("ten.host")}</th><th className="px-4 py-2.5">IP</th><th className="px-4 py-2.5">{tr("ten.tenant")}</th></tr>
          </thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-4 py-2 text-ink">{h.name}</td>
                <td className="px-4 py-2 text-ink-faint">{h.hostname_or_ip}</td>
                <td className="px-4 py-2">
                  <select value={h.tenant_id ?? 0} onChange={(e) => setHost(h.id, Number(e.target.value))} className="input py-1 text-xs">
                    <option value={0}>{tr("ten.globalUnassigned")}</option>
                    {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Assignation des utilisateurs */}
      <Card className="overflow-hidden p-0">
        <div className="p-5 pb-2"><SectionTitle title={tr("ten.assignUsers")} icon={Users} /></div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-bg-soft/50 text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr><th className="px-4 py-2.5">{tr("ten.user")}</th><th className="px-4 py-2.5">{tr("ten.role")}</th><th className="px-4 py-2.5">{tr("ten.tenantMsp")}</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2 text-ink">{u.email}</td>
                <td className="px-4 py-2 text-ink-faint">{u.role}</td>
                <td className="px-4 py-2">
                  <select value={(u as User & { tenant_id?: number }).tenant_id ?? 0} onChange={(e) => setUser(u.id, Number(e.target.value))} className="input py-1 text-xs">
                    <option value={0}>{tr("ten.mspGlobal")}</option>
                    {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
