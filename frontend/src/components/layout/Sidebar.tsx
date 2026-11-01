import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, Lock, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { BrandLogo } from "../ui/BrandLogo";
import { useBranding } from "../../lib/branding";
import { useI18n } from "../../lib/i18n";
import { useLicense, FEATURE_PLAN, PLAN_LABEL } from "../../lib/license";
import { NAV_GROUPS, type NavItem } from "../../lib/nav";

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const { has, loading } = useLicense();
  const Icon = item.icon;
  const label = t(item.labelKey);
  const locked = !!item.feature && !loading && !has(item.feature);
  const plan = item.feature ? PLAN_LABEL[FEATURE_PLAN[item.feature]] : "";
  const fullLabel = locked ? `${label} — ${t("license.requires")} ${plan}` : label;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? fullLabel : locked ? fullLabel : undefined}
      aria-label={collapsed || locked ? fullLabel : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex min-h-[34px] items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
          isActive ? "bg-brand/15 text-ink" : "text-ink-soft hover:bg-card hover:text-ink",
          collapsed && "justify-center px-0",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand" aria-hidden />}
          <Icon className={cn("h-[17px] w-[17px] shrink-0", isActive && "text-brand")} aria-hidden />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {locked && !collapsed && <Lock className="h-3 w-3 shrink-0 text-accent-violet" aria-hidden />}
        </>
      )}
    </NavLink>
  );
}

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("a11y.mainNav")} className="flex-1 overflow-y-auto px-3 pb-3">
      {NAV_GROUPS.map((g) => (
        <div key={g.id} className="mt-4 first:mt-2">
          {collapsed ? (
            <div className="mx-auto mb-1.5 h-px w-6 bg-border" aria-hidden />
          ) : (
            <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">{t(g.labelKey)}</p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.to}><Item item={item} collapsed={collapsed} onNavigate={onNavigate} /></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { branding } = useBranding();
  return (
    <div className={cn("flex h-14 shrink-0 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
      <BrandLogo className="h-8 w-8 shrink-0" />
      {!collapsed && <span className="truncate text-[15px] font-bold tracking-tight text-ink">{branding.display_name}</span>}
    </div>
  );
}

/** Barre latérale desktop (≥ lg), repliable. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <aside
      className={cn(
        "relative z-20 hidden shrink-0 flex-col border-r border-border bg-bg-soft transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-[236px]",
      )}
    >
      <Brand collapsed={collapsed} />
      <NavContent collapsed={collapsed} />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("topbar.expand") : t("topbar.collapse")}
        className="m-3 flex min-h-[34px] items-center justify-center gap-2 rounded-lg border border-border text-xs text-ink-faint transition hover:text-ink"
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
        {!collapsed && t("topbar.collapse")}
      </button>
    </aside>
  );
}

/** Tiroir de navigation (< lg) : Échap, clic sur le fond, piège de focus, fermeture à la navigation. */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    el?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("a, button"));
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div ref={panel} id="mobile-nav" role="dialog" aria-modal="true" aria-label={t("a11y.mainNav")}
        className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col border-r border-border bg-bg-soft shadow-pop">
        <div className="flex items-center justify-between pr-3">
          <Brand collapsed={false} />
          <button type="button" onClick={onClose} className="icon-btn" aria-label={t("topbar.closeMenu")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavContent collapsed={false} onNavigate={onClose} />
      </div>
    </div>
  );
}
