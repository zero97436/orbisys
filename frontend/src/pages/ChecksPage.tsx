import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ListChecks, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { deleteCheck, listChecks, listHosts, runCheck } from "../api/endpoints";
import type { Check, CheckStatus } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { FilterChips, Pagination, SearchInput, paginate } from "../components/ui/ListControls";
import { EmptyState, ErrorState, Loading } from "../components/States";
import { CheckForm } from "../components/checks/CheckForm";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import { SEVERITY_RANK } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { metaFor } from "../lib/checkMeta";
import { usePolling } from "../hooks/usePolling";
import { apiErrorMessage } from "../lib/apiError";
import { useAuth } from "../lib/auth";
import { canEdit } from "../lib/permissions";
import { useI18n } from "../lib/i18n";

type SortKey = "status" | "name" | "host" | "type" | "interval";
type StatusFilter = CheckStatus | "ALL";
const statusOf = (c: Check): CheckStatus => c.last_status ?? "UNKNOWN";

export default function ChecksPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const editable = canEdit(user);
  const [params, setParams] = useSearchParams();

  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([listChecks(), listHosts()]).then(([c, h]) => ({ checks: c.data, hosts: h.data })),
    30000,
  );
  const checks = data?.checks ?? [];
  const hosts = data?.hosts ?? [];
  const hostName = useMemo(() => new Map(hosts.map((h) => [h.id, h.name])), [hosts]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [type, setType] = useState("");
  const hostFilter = Number(params.get("host")) || 0;
  const setHostFilter = (id: number) => setParams((p) => { if (id) p.set("host", String(id)); else p.delete("host"); return p; }, { replace: true });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Check | null>(null);
  const [running, setRunning] = useState<Set<number>>(new Set());

  useEffect(() => { setPage(1); }, [q, status, type, hostFilter, sort]);

  const counts = useMemo(() => {
    const c: Record<CheckStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0, UNKNOWN: 0 };
    for (const ch of checks) if (!hostFilter || ch.host_id === hostFilter) c[statusOf(ch)] += 1;
    return c;
  }, [checks, hostFilter]);
  const types = useMemo(() => [...new Set(checks.map((c) => c.type))].sort(), [checks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = checks.filter((c) =>
      (status === "ALL" || statusOf(c) === status) &&
      (!type || c.type === type) &&
      (!hostFilter || c.host_id === hostFilter) &&
      (!needle || [c.name, c.type, hostName.get(c.host_id) ?? ""].some((s) => s.toLowerCase().includes(needle))),
    );
    const cmp: Record<SortKey, (a: Check, b: Check) => number> = {
      status: (a, b) => SEVERITY_RANK[statusOf(a)] - SEVERITY_RANK[statusOf(b)] || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      host: (a, b) => (hostName.get(a.host_id) ?? "").localeCompare(hostName.get(b.host_id) ?? "") || a.name.localeCompare(b.name),
      type: (a, b) => a.type.localeCompare(b.type),
      interval: (a, b) => a.interval_seconds - b.interval_seconds,
    };
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [checks, q, status, type, hostFilter, sort, hostName]);
  const pageItems = paginate(filtered, page);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const onSaved = () => { setFormOpen(false); toast.success(editing ? t("chk.saved") : t("chk.created")); refresh(); };

  const run = async (c: Check) => {
    setRunning((s) => new Set(s).add(c.id));
    try {
      const { data: r } = await runCheck(c.id);
      const msg = `${c.name} : ${t(`status.${r.status}`)}${r.message ? ` — ${r.message}` : ""}`;
      if (r.status === "OK") toast.success(msg); else toast.info(msg);
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    } finally {
      setRunning((s) => { const n = new Set(s); n.delete(c.id); return n; });
    }
  };

  const remove = async (c: Check) => {
    const ok = await confirm({
      title: t("chk.deleteTitle"),
      message: t("chk.deleteBody"),
      details: `${c.name} · ${hostName.get(c.host_id) ?? "—"} · ${c.type}`,
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCheck(c.id);
      toast.success(t("chk.deleted"));
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
    }
  };

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
        helpTopic="checks"
        titleKey="chk.title"
        subtitle={`${checks.length} ${t("chk.subtitle")}`}
        actions={editable && (
          <button type="button" onClick={openCreate} className="btn-primary" disabled={!hosts.length} title={!hosts.length ? t("chk.needHost") : undefined}>
            <Plus className="h-4 w-4" aria-hidden /> {t("chk.new")}
          </button>
        )}
      />

      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("chk.searchPh")} className="min-w-[220px] flex-1" />
          <label className="sr-only" htmlFor="chk-host">{t("chk.hostToMonitor")}</label>
          <select id="chk-host" className="input" value={hostFilter} onChange={(e) => setHostFilter(Number(e.target.value))}>
            <option value={0}>{t("chk.allHosts")}</option>
            {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="chk-type">{t("chk.controlType")}</label>
          <select id="chk-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t("chk.allTypes")}</option>
            {types.map((ty) => <option key={ty} value={ty}>{metaFor(ty, lang).label}</option>)}
          </select>
        </div>
        <FilterChips<StatusFilter>
          label={t("list.statusFilter")}
          value={status}
          onChange={setStatus}
          options={[
            { v: "ALL", label: t("common.all"), count: counts.OK + counts.WARNING + counts.CRITICAL + counts.UNKNOWN },
            ...(["CRITICAL", "WARNING", "UNKNOWN", "OK"] as const).map((s) => ({ v: s, label: t(`status.${s}`), count: counts[s], tone: statusMeta(s).dot })),
          ]}
        />
      </div>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : checks.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("chk.emptyTitle")} message={hosts.length ? t("chk.emptyHint") : t("chk.needHost")}
          action={editable ? (hosts.length
            ? <button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> {t("chk.new")}</button>
            : <Link to="/hosts" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("dash.addHost")}</Link>) : undefined} />
      ) : filtered.length === 0 ? (
        <EmptyState message={t("list.noMatch")} action={<button type="button" className="btn-ghost" onClick={() => { setQ(""); setStatus("ALL"); setType(""); setHostFilter(0); }}>{t("list.reset")}</button>} />
      ) : (
        <div className="card relative overflow-x-auto p-0">
          <table className="table-std min-w-[820px]">
            <caption className="sr-only">{t("chk.title")}</caption>
            <thead>
              <tr>
                <SortHeader k="status" label={t("list.col.status")} className="w-36" />
                <SortHeader k="name" label={t("chk.colName")} />
                <SortHeader k="host" label={t("ten.host")} />
                <SortHeader k="type" label={t("chk.colType")} />
                <th scope="col">{t("chk.executedBy")}</th>
                <SortHeader k="interval" label={t("chk.colInterval")} className="text-right" />
                {editable && <th scope="col" className="text-right"><span className="sr-only">{t("common.actions")}</span></th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => {
                const busy = running.has(c.id);
                return (
                  <tr key={c.id}>
                    <td><StatusBadge status={c.last_status} size="xs" /></td>
                    <td><Link to={`/checks/${c.id}`} className="font-medium text-ink hover:text-brand">{c.name}</Link></td>
                    <td>
                      <Link to={`/hosts/${c.host_id}`} className="text-ink-soft hover:text-brand">{hostName.get(c.host_id) ?? "—"}</Link>
                    </td>
                    <td className="text-xs text-ink-soft">{metaFor(c.type, lang).label}</td>
                    <td className="text-xs text-ink-soft">{c.executor_host_id ? `${t("chk.agentPrefix")} ${hostName.get(c.executor_host_id) ?? "?"}` : t("chk.central")}</td>
                    <td className="text-right text-xs tabular-nums text-ink-soft">{c.interval_seconds} s</td>
                    {editable && (
                      <td className="whitespace-nowrap text-right">
                        <button type="button" className="icon-btn h-8 w-8 hover:text-brand" onClick={() => run(c)} disabled={busy}
                          aria-label={`${t("chk.runNow")} ${c.name}`} title={t("chk.runNow")}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                        </button>{" "}
                        <button type="button" className="icon-btn h-8 w-8" onClick={() => { setEditing(c); setFormOpen(true); }}
                          aria-label={`${t("common.edit")} ${c.name}`} title={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>{" "}
                        <button type="button" className="icon-btn h-8 w-8 hover:text-status-critical" onClick={() => remove(c)}
                          aria-label={`${t("common.delete")} ${c.name}`} title={t("common.delete")}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={filtered.length} onPage={setPage} />

      <CheckForm open={formOpen} check={editing} hosts={hosts} defaultHostId={hostFilter || undefined}
        onClose={() => setFormOpen(false)} onSaved={onSaved} />
    </div>
  );
}
