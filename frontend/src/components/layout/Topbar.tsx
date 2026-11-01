import { useState } from "react";
import { Bell, ChevronRight, LogOut, Menu, Monitor, MonitorPlay, Moon, Search, ShieldCheck, Sun, WifiOff } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useNow } from "../../hooks/useNow";
import { statusMeta } from "../../lib/status";
import { overallStatus } from "../../lib/fleet";
import { localeOf } from "../../lib/format";
import { navMatch } from "../../lib/nav";
import { useLiveStatus } from "../../lib/liveStatus";
import { cn } from "../../lib/cn";
import { applyTheme, getTheme, type Theme } from "../../lib/theme";
import { useI18n, type Lang } from "../../lib/i18n";

/** Groupe de boutons à choix unique (thème, langue). */
function Segmented<T extends string>({ label, value, options, onChange, className }: {
  label: string;
  value: T;
  options: { v: T; content: React.ReactNode; title: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          title={o.title}
          className={cn(
            "grid h-6 min-w-6 place-items-center rounded px-1 text-[11px] font-semibold uppercase",
            value === o.v ? "bg-brand-soft text-white" : "text-ink-faint hover:text-ink",
          )}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitcher() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(getTheme());
  const icon = (I: typeof Moon, l: string) => <><I className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">{l}</span></>;
  return (
    <Segmented
      label={t("topbar.theme")}
      className="hidden xl:flex"
      value={theme}
      onChange={(v) => { applyTheme(v); setTheme(v); }}
      options={[
        { v: "dark", title: t("theme.dark"), content: icon(Moon, t("theme.dark")) },
        { v: "light", title: t("theme.light"), content: icon(Sun, t("theme.light")) },
        { v: "system", title: t("theme.system"), content: icon(Monitor, t("theme.system")) },
      ]}
    />
  );
}

function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <Segmented<Lang>
      label={t("lang.switch")}
      className="hidden md:flex"
      value={lang}
      onChange={setLang}
      options={[
        { v: "fr", title: "Français", content: <span lang="fr">FR</span> },
        { v: "en", title: "English", content: <span lang="en">EN</span> },
      ]}
    />
  );
}

/** Fil d'Ariane dérivé du modèle de navigation : groupe › module › détail. */
function Breadcrumb() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const m = navMatch(pathname);
  if (!m) return null;
  const detail = pathname !== m.item.to ? pathname.slice(m.item.to.length + 1) : null;
  return (
    <nav aria-label={t("a11y.breadcrumb")} className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0 text-ink-faint">{t(m.group.labelKey)}</li>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
        <li className="min-w-0 truncate">
          {detail ? (
            <Link to={m.item.to} className="text-ink-soft hover:text-ink">{t(m.item.labelKey)}</Link>
          ) : (
            <span aria-current="page" className="font-medium text-ink">{t(m.item.labelKey)}</span>
          )}
        </li>
        {detail && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
            <li aria-current="page" className="truncate font-mono text-xs text-ink">#{detail}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

/** État global : couleur + icône + texte, et signalement explicite d'une perte de connexion. */
function GlobalState() {
  const { t, lang } = useI18n();
  const { summary, stale, updatedAt } = useLiveStatus();
  const status = summary ? overallStatus(summary.status_counts) : "UNKNOWN";
  const meta = statusMeta(status);
  const Icon = meta.icon;
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  if (stale) {
    return (
      <span role="status" className="flex items-center gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning"
        title={`${t("live.stale")} · ${t("live.updated")} ${updated}`}>
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{t("live.staleShort")}</span>
        <span className="sr-only sm:hidden">{t("live.stale")}</span>
      </span>
    );
  }
  return (
    <Link to="/dashboard" className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-card"
      title={`${t("live.updated")} ${updated}`}>
      <Icon className={cn("h-4 w-4", meta.text)} aria-hidden />
      <span className="hidden text-ink-soft lg:inline">{t("topbar.platform")}{lang === "fr" ? " :" : ":"}</span>
      <span className={cn("font-medium", meta.text)}>{t(`status.${status}`)}</span>
    </Link>
  );
}

function IncidentsButton() {
  const { t } = useI18n();
  const { incidents } = useLiveStatus();
  const open = incidents?.filter((i) => !i.acknowledged) ?? [];
  const critical = open.some((i) => i.status === "CRITICAL");
  const label = open.length ? `${t("topbar.incidents")} : ${open.length}` : t("topbar.noIncident");
  return (
    <Link to="/incidents" className="icon-btn relative" aria-label={label} title={label}>
      <Bell className="h-4 w-4" aria-hidden />
      {open.length > 0 && (
        <span className={cn(
          "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums text-white",
          critical ? "bg-status-critical" : "bg-status-warning",
        )} aria-hidden>
          {open.length > 99 ? "99+" : open.length}
        </span>
      )}
    </Link>
  );
}

function Clock() {
  const { lang } = useI18n();
  const now = useNow();
  return (
    <time dateTime={now.toISOString()} className="hidden text-xs tabular-nums text-ink-soft 2xl:block">
      {now.toLocaleString(localeOf(lang), { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </time>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const roleLabel = (role: string) => (["admin", "operator", "viewer"].includes(role) ? t(`role.${role}`) : role);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-soft/70 px-3 backdrop-blur sm:px-5">
      <button type="button" onClick={onOpenMenu} className="icon-btn lg:hidden" aria-label={t("topbar.openMenu")}
        aria-controls="mobile-nav">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <GlobalState />
      <span className="hidden h-5 w-px bg-border md:block" aria-hidden />
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only md:not-sr-only">{t("topbar.search")}</span>
          <kbd className="hidden rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] md:inline" aria-hidden>Ctrl K</kbd>
        </button>
        <IncidentsButton />
        <Link to="/tv" className="icon-btn hidden lg:grid" aria-label={t("topbar.tv")} title={t("topbar.tv")}>
          <MonitorPlay className="h-4 w-4" aria-hidden />
        </Link>
        <LangSwitcher />
        <ThemeSwitcher />
        <Clock />
        {user && (
          <span className="hidden items-center gap-1.5 text-xs md:flex">
            <span className="max-w-[180px] truncate text-ink-faint" title={user.email}>{user.email}</span>
            <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-brand">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {roleLabel(user.role)}
            </span>
          </span>
        )}
        <button type="button" onClick={logout} className="icon-btn" aria-label={t("topbar.logout")} title={t("topbar.logout")}>
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
