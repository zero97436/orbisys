import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MobileNav, Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "../CommandPalette";
import { LicenseProvider } from "../../lib/license";
import { LiveStatusProvider } from "../../lib/liveStatus";
import { useI18n } from "../../lib/i18n";

const STORAGE_KEY = "sh_sidebar_collapsed";

/** Shell de l'application : navigation, barre supérieure, état partagé (licence, état live). */
export function DashboardLayout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <LicenseProvider>
      <LiveStatusProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-white">
          {t("a11y.skip")}
        </a>
        <div className="flex h-screen overflow-hidden bg-bg text-ink">
          <CommandPalette />
          <Sidebar collapsed={collapsed} onToggle={toggle} />
          <MobileNav open={mobileOpen} onClose={closeMobile} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenMenu={() => setMobileOpen(true)} />
            <main id="main" tabIndex={-1} className="flex-1 overflow-auto p-4 outline-none sm:p-6">
              <div key={pathname} className="page-enter mx-auto w-full max-w-[1680px]">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </LiveStatusProvider>
    </LicenseProvider>
  );
}
