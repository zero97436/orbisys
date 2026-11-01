import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, Server, ListChecks, Ticket, History, CornerDownLeft, Lock, type LucideIcon } from "lucide-react";
import { globalSearch, type SearchResults } from "../api/endpoints";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";
import { NAV_ITEMS } from "../lib/nav";
import { useLicense } from "../lib/license";
import { statusMeta } from "../lib/status";
import type { CheckStatus } from "../types";

interface Item {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  group: string;
  to: string;
  status?: CheckStatus;
  locked?: boolean;
}

const isStatus = (s: string | null): s is CheckStatus => s === "OK" || s === "WARNING" || s === "CRITICAL" || s === "UNKNOWN";

/** Palette Ctrl+K : navigation vers tous les modules et recherche globale (hôtes, checks, tickets, événements). */
export function CommandPalette() {
  const { t } = useI18n();
  const { has, loading: licLoading } = useLicense();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const listId = useId();
  const navigate = useNavigate();

  // Raccourci global Ctrl+K / Cmd+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    setQ("");
    setResults(null);
    setActive(0);
    inputRef.current?.focus();
    return () => restore.current?.focus?.();
  }, [open]);

  // Recherche serveur débouncée (≥ 2 caractères).
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      globalSearch(needle)
        .then((r) => { setResults(r.data); setActive(0); })
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const needle = q.trim().toLowerCase();
    const pages = NAV_ITEMS.filter((p) => !needle || t(p.labelKey).toLowerCase().includes(needle));
    for (const p of needle ? pages.slice(0, 6) : pages) {
      out.push({
        key: `page:${p.to}`, icon: p.icon, title: t(p.labelKey), group: "cmd.grp.pages", to: p.to,
        locked: !!p.feature && !licLoading && !has(p.feature),
      });
    }
    if (results) {
      for (const h of results.hosts) {
        out.push({ key: `h:${h.id}`, icon: Server, title: h.name, subtitle: h.hostname_or_ip, group: "cmd.grp.hosts", to: `/hosts/${h.id}` });
      }
      for (const c of results.checks) {
        out.push({
          key: `c:${c.id}`, icon: ListChecks, title: c.name, subtitle: `${c.host_name} · ${c.type}`,
          group: "cmd.grp.checks", to: `/checks/${c.id}`, status: isStatus(c.last_status) ? c.last_status : undefined,
        });
      }
      for (const tk of results.tickets) {
        out.push({ key: `t:${tk.id}`, icon: Ticket, title: `#${tk.id} ${tk.title}`, subtitle: `${tk.status} · ${tk.priority}`, group: "cmd.grp.tickets", to: "/tickets" });
      }
      for (const e of results.events) {
        out.push({ key: `e:${e.id}`, icon: History, title: e.message.slice(0, 90), subtitle: e.level, group: "cmd.grp.events", to: "/events" });
      }
    }
    return out;
  }, [q, results, t, has, licLoading]);

  const go = useCallback((item: Item) => {
    setOpen(false);
    navigate(item.to);
  }, [navigate]);

  // Garde l'élément actif visible pendant la navigation clavier.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
    else if (e.key === "Tab") { e.preventDefault(); } // le focus reste dans le champ (combobox)
  };

  if (!open) return null;
  let lastGroup = "";
  const empty = q.trim().length >= 2 && !searching ? t("cmd.noResult") : t("cmd.min2");

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label={t("cmd.globalSearch")} onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder={t("cmd.searchPh")}
            aria-label={t("cmd.searchPh")}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] text-ink-faint">Esc</kbd>
        </div>

        <div id={listId} role="listbox" aria-label={t("cmd.globalSearch")} className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-faint">{searching ? t("common.loading") : empty}</p>
          ) : (
            items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const meta = item.status ? statusMeta(item.status) : null;
              return (
                <div key={item.key} role="presentation">
                  {header && (
                    <p role="presentation" className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                      {t(header)}
                    </p>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(item)}
                    onMouseMove={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                      i === active ? "bg-brand/15" : "hover:bg-bg-soft",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{item.title}</p>
                      {item.subtitle && <p className="truncate text-xs text-ink-faint">{item.subtitle}</p>}
                    </div>
                    {item.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-accent-violet" aria-label={t("license.locked.title")} />}
                    {meta && (
                      <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", meta.text)}>
                        <meta.icon className="h-3.5 w-3.5" aria-hidden />{meta.label}
                      </span>
                    )}
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-bg-soft/40 px-4 py-2 text-[10px] text-ink-faint" aria-hidden>
          <span>↑↓ {t("cmd.navigate")}</span><span>↵ {t("cmd.open")}</span><span>Esc {t("cmd.close")}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
