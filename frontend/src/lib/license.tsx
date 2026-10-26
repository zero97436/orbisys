/** Édition sous licence, lue depuis le backend (GET /hosts/license).
 *
 *  Sert UNIQUEMENT à l'affichage : signaler un module réservé à une édition
 *  supérieure, éviter d'appeler une route absente en Community (404), afficher
 *  quota et expiration. Le backend reste seul juge : il refuse toujours (403)
 *  une fonctionnalité non couverte, quoi qu'affiche le frontend. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getLicense, type LicenseInfo } from "../api/endpoints";

/** Édition minimale de chaque fonctionnalité (miroir de backend/app/core/license.py, pour les messages). */
export const FEATURE_PLAN: Record<string, "professional" | "business" | "enterprise"> = {
  advanced_channels: "professional",
  sla_reports: "professional",
  pdf_reports: "professional",
  custom_dashboards: "professional",
  extended_retention: "professional",
  branding: "professional",
  itsm_connectors: "business",
  remediation: "business",
  distributed: "business",
  multi_tenant: "business",
  api_extended: "business",
  ha: "enterprise",
  sso: "enterprise",
  audit: "enterprise",
  support_247: "enterprise",
};

export const PLAN_LABEL: Record<string, string> = {
  community: "Community",
  professional: "Professional",
  business: "Business",
  enterprise: "Enterprise",
};

interface LicenseCtx {
  license: LicenseInfo | null;
  /** true tant que la licence n'est pas connue (on n'affiche alors aucun verrou). */
  loading: boolean;
  has: (feature: string) => boolean;
  refresh: () => void;
}

const Ctx = createContext<LicenseCtx>({ license: null, loading: true, has: () => true, refresh: () => {} });

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getLicense()
      .then((r) => setLicense(r.data))
      .catch(() => setLicense(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Licence inconnue (erreur réseau) : on ne verrouille rien côté interface ; le backend décide.
  const has = useCallback(
    (feature: string) => (license ? license.features.includes(feature) : true),
    [license],
  );

  return <Ctx.Provider value={{ license, loading, has, refresh }}>{children}</Ctx.Provider>;
}

export const useLicense = () => useContext(Ctx);
