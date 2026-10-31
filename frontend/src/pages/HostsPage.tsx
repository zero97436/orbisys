import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, LayoutGrid, List, Pencil, Plus, Radar, Server, Trash2, Upload } from "lucide-react";
import { DiscoveryPanel } from "../components/DiscoveryPanel";
import { ImportPanel } from "../components/ImportPanel";
import { HostForm } from "../components/hosts/HostForm";
import { deleteHost, listChecks, listHosts } from "../api/endpoints";
import type { CheckStatus, Host } from "../types";
import type { HostView } from "../components/ui/HostCard";
import { PageHeader } from "../components/ui/PageHeader";
import { MotionGrid } from "../components/ui/Card";
import { HostCard } from "../components/ui/HostCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { FilterChips, Pagination, SearchInput, paginate } from "../components/ui/ListControls";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { buildHostViews, hostBuckets, SEVERITY_RANK } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { usePolling } from "../hooks/usePolling";
import { PLAN_LABEL, useLicense } from "../lib/license";
import { apiErrorMessage } from "../lib/apiError";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

type SortKey = "status" | "name" | "address" | "environment" | "checks";
type StatusFilter = CheckStatus | "ALL";
const VIEW_KEY = "orbisys_hosts_view";

export default function HostsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const editable = canEdit(user);
  const { license, refresh: refreshLicense } = useLicense();

  // Inventaire rafraîchi toutes les 30 s (pause onglet masqué) : statuts à jour sans recharger.
  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([listHosts(), listChecks()]).then(([h, c]) => ({ hosts: h.data, checks: c.data })),
    30000,
  );
  const hosts = data?.hosts ?? [];
  const views = useMemo(() => buildHostViews(data?.hosts ?? [], data?.checks ?? []), [data]);
  const counts = useMemo(() => hostBuckets(views), [views]);
  const environments = useMemo(() => [...new Set(hosts.map((h) => h.environment).filter(Boolean))].sort(), [hosts]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [env, setEnv] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "cards">(() => (localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table"));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Host | null>(null);
  const [panel, setPanel] = useState<"discovery" | "import" | null>(null);

  useEffect(() => { setPage(1); }, [q, status, env, sort]);
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = views.filter((h) =>
      (status === "ALL" || h.status === status) &&
      (!env || h.environment === env) &&
      (!needle || [h.name, h.hostname_or_ip, h.environment, h.location ?? "", h.description ?? ""].some((s) => s.toLowerCase().includes(needle))),
    );
    const cmp: Record<SortKey, (a: HostView, b: HostView) => number> = {
      status: (a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      address: (a, b) => a.hostname_or_ip.localeCompare(b.hostname_or_ip, undefined, { numeric: true }),
      environment: (a, b) => a.environment.localeCompare(b.environment) || a.name.localeCompare(b.name),
      checks: (a, b) => (a.checksCount ?? 0) - (b.checksCount ?? 0),
    };
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [views, q, status, env, sort]);
  const pageItems = paginate(filtered, page);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (h: Host) => { setEditing(h); setFormOpen(true); };
  const onSaved = () => {
    setFormOpen(false);
    toast.success(editing ? t("hosts.saved") : t("hosts.created"));
    refresh();
    refreshLicense();
  };

  const remove = async (h: HostView) => {
    const ok = await confirm({
      title: t("hosts.deleteTitle"),
      message: t("hosts.deleteBody").replace("{n}", String(h.checksCount ?? 0)),
      details: `${h.name} · ${h.hostname_or_ip}`,
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteHost(h.id);
      toast.success(t("hosts.deleted").replace("{name}", h.name));
      refresh();
      refreshLicense();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
  };

  const quota = license
    ? license.max_hosts == null
      ? `${license.used} ${t("hosts.hostsSuffix")} · ${PLAN_LABEL[license.plan] ?? license.plan}`
      : `${license.used}/${license.max_hosts} ${t("hosts.hostsSuffix")} · ${PLAN_LABEL[license.plan] ?? license.plan}`
    : `${views.length} ${t("hosts.supervised")}`;
  const atQuota = !!license && license.max_hosts != null && license.used >= license.max_hosts;

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const active = sort.key === k;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={className}>
        <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-ink"
          onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
          {label}
          {active && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        helpTopic="hosts"
        titleKey="hosts.title"
        subtitle={quota}
        actions={editable && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPanel((p) => (p === "discovery" ? null : "discovery"))} className="btn-ghost" aria-pressed={panel === "discovery"}>
              <Radar className="h-4 w-4" aria-hidden /> {t("hosts.discovery")}
            </button>
            <button type="button" onClick={() => setPanel((p) => (p === "import" ? null : "import"))} className="btn-ghost" aria-pressed={panel === "import"}>
              <Upload className="h-4 w-4" aria-hidden /> {t("hosts.import")}
            </button>
            <button type="button" onClick={openCreate} className="btn-primary" disabled={atQuota} title={atQuota ? t("hosts.quotaReached") : undefined}>
              <Plus className="h-4 w-4" aria-hidden /> {t("hosts.new")}
            </button>
          </div>
        )}
      />

      {atQuota && editable && (
        <p role="status" className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-2.5 text-sm text-ink">
          {t("hosts.quotaReached")}{" "}
          <a href="https://orbisys.app/#pricing" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">{t("license.locked.cta")}</a>
        </p>
      )}
      {panel === "import" && editable && <ImportPanel onImported={() => { refresh(); refreshLicense(); }} />}
      {panel === "discovery" && editable && <DiscoveryPanel onImported={() => { refresh(); refreshLicense(); }} />}

      {/* Barre d'outils : recherche, filtres, vue */}
      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("hosts.searchPh")} className="min-w-[220px] flex-1" />
          <label className="sr-only" htmlFor="hosts-env">{t("hosts.f.environment")}</label>
          <select id="hosts-env" className="input" value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="">{t("hosts.allEnvs")}</option>
            {environments.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <div role="group" aria-label={t("list.view")} className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
            {([["table", List, t("list.viewTable")], ["cards", LayoutGrid, t("list.viewCards")]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} title={label}
                className={cn("grid h-8 w-8 place-items-center rounded", view === v ? "bg-brand-soft text-white" : "text-ink-faint hover:text-ink")}>
                <Icon className="h-4 w-4" aria-hidden /><span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <FilterChips<StatusFilter>
          label={t("list.statusFilter")}
          value={status}
          onChange={setStatus}
          options={[
            { v: "ALL", label: t("common.all"), count: views.length },
            ...(["CRITICAL", "WARNING", "UNKNOWN", "OK"] as const).map((s) => ({ v: s, label: t(`status.${s}`), count: counts[s], tone: statusMeta(s).dot })),
          ]}
        />
      </div>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : views.length === 0 ? (
        <EmptyState icon={Server} title={t("hosts.emptyTitle")} message={t("hosts.emptyHint")}
          action={editable ? <button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> {t("hosts.new")}</button> : undefined} />
      ) : filtered.length === 0 ? (
        <EmptyState message={t("list.noMatch")} action={<button type="button" className="btn-ghost" onClick={() => { setQ(""); setStatus("ALL"); setEnv(""); }}>{t("list.reset")}</button>} />
      ) : view === "cards" ? (
        <MotionGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((h) => (
            <HostCard key={h.id} host={h} onDelete={editable ? () => remove(h) : undefined} onEdit={editable ? openEdit : undefined} />
          ))}
        </MotionGrid>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-std min-w-[760px]">
            <caption className="sr-only">{t("hosts.title")}</caption>
            <thead>
              <tr>
                <SortHeader k="status" label={t("list.col.status")} className="w-36" />
                <SortHeader k="name" label={t("common.name")} />
                <SortHeader k="address" label={t("hosts.f.hostnameIp")} />
                <SortHeader k="environment" label={t("hosts.f.environment")} />
                <th scope="col">{t("hosts.col.mode")}</th>
                <SortHeader k="checks" label={t("common.checks")} className="text-right" />
                {editable && <th scope="col" className="text-right"><span className="sr-only">{t("common.actions")}</span></th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((h) => (
                <tr key={h.id}>
                  <td><StatusBadge status={h.status} size="xs" /></td>
                  <td className="max-w-[260px]">
                    <Link to={`/hosts/${h.id}`} className="font-medium text-ink hover:text-brand">{h.name}</Link>
                    {(h.description || h.location) && <p className="truncate text-xs text-ink-faint">{[h.location, h.description].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className="font-mono text-xs text-ink-soft">{h.hostname_or_ip}</td>
                  <td><span className="chip py-0.5">{h.environment}</span></td>
                  <td className="text-xs text-ink-soft">{t(`hosts.modeShort.${h.monitoring_mode}`)}</td>
                  <td className="text-right tabular-nums">
                    {h.checksCount ? h.checksCount : <span className="text-xs text-status-unknown">{t("hosts.noChecks")}</span>}
                  </td>
                  {editable && (
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="icon-btn h-8 w-8" onClick={() => openEdit(h)} aria-label={`${t("common.edit")} ${h.name}`} title={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>{" "}
                      <button type="button" className="icon-btn h-8 w-8 hover:text-status-critical" onClick={() => remove(h)} aria-label={`${t("common.delete")} ${h.name}`} title={t("common.delete")}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={filtered.length} onPage={setPage} />

      <HostForm open={formOpen} host={editing} hosts={hosts} environments={environments} onClose={() => setFormOpen(false)} onSaved={onSaved} />
    </div>
  );
}
