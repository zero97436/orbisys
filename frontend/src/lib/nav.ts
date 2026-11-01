/** Modèle de navigation unique : barre latérale, fil d'Ariane et palette Ctrl+K.
 *  Uniquement des modules qui existent (une route par entrée). `feature` = fonction
 *  sous licence : l'entrée reste visible avec un cadenas (le module existe), la page
 *  affiche alors l'édition requise au lieu d'appeler une route absente. */
import {
  LayoutDashboard, Activity, MonitorPlay, LayoutGrid, Briefcase,
  Server, ListChecks, LayoutTemplate, Container, Rocket, Share2, MapPin,
  AlertTriangle, Ticket, History,
  FileBarChart,
  Bot, BookOpen,
  Building2, ShieldCheck, Settings, LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  feature?: string;
  /** Ouvre une vue plein écran hors du shell (mode TV). */
  external?: boolean;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    labelKey: "navg.overview",
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/monitoring", labelKey: "nav.monitoring", icon: Activity },
      { to: "/operations", labelKey: "nav.operations", icon: LayoutGrid },
      { to: "/bam", labelKey: "nav.business", icon: Briefcase },
      { to: "/tv", labelKey: "nav.noc", icon: MonitorPlay, external: true },
    ],
  },
  {
    id: "monitor",
    labelKey: "navg.monitor",
    items: [
      { to: "/hosts", labelKey: "nav.hosts", icon: Server },
      { to: "/checks", labelKey: "nav.checks", icon: ListChecks },
      { to: "/templates", labelKey: "nav.templates", icon: LayoutTemplate },
      { to: "/containers", labelKey: "nav.containers", icon: Container },
      { to: "/apm", labelKey: "nav.apm", icon: Rocket },
      { to: "/topology", labelKey: "nav.topology", icon: Share2 },
      { to: "/geo", labelKey: "nav.map", icon: MapPin },
    ],
  },
  {
    id: "operate",
    labelKey: "navg.operate",
    items: [
      { to: "/incidents", labelKey: "nav.incidents", icon: AlertTriangle },
      { to: "/tickets", labelKey: "nav.tickets", icon: Ticket },
      { to: "/events", labelKey: "nav.events", icon: History },
    ],
  },
  {
    id: "analyze",
    labelKey: "navg.analyze",
    items: [{ to: "/reports", labelKey: "nav.reports", icon: FileBarChart, feature: "sla_reports" }],
  },
  {
    id: "ai",
    labelKey: "navg.ai",
    items: [
      { to: "/assistant", labelKey: "nav.assistant", icon: Bot },
      { to: "/knowledge", labelKey: "nav.knowledge", icon: BookOpen },
    ],
  },
  {
    id: "admin",
    labelKey: "navg.admin",
    items: [
      { to: "/tenants", labelKey: "nav.tenants", icon: Building2, feature: "multi_tenant" },
      { to: "/audit", labelKey: "nav.audit", icon: ShieldCheck, feature: "audit" },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
      { to: "/docs", labelKey: "nav.docs", icon: LifeBuoy },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Entrée de navigation et groupe correspondant à un chemin (y compris /hosts/12). */
export function navMatch(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(item.to + "/")) return { group, item };
    }
  }
  return null;
}
