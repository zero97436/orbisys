/** État de supervision partagé par le shell et les pages (résumé + incidents actifs).
 *  Une seule requête périodique au lieu d'une par composant ; pause quand l'onglet est
 *  masqué (usePolling). La fréquence d'affichage ne touche pas la supervision elle-même. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getIncidents, getSummary } from "../api/endpoints";
import { usePolling } from "../hooks/usePolling";
import type { DashboardSummary, Incident } from "../types";

interface LiveStatus {
  summary: DashboardSummary | null;
  incidents: Incident[] | null;
  /** Dernière mise à jour réussie (ms). */
  updatedAt: number | null;
  /** true si la dernière tentative a échoué (backend injoignable / déconnexion). */
  stale: boolean;
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<LiveStatus>({
  summary: null, incidents: null, updatedAt: null, stale: false, loading: true, refresh: () => {},
});

export const LIVE_INTERVAL_MS = 20000;

export function LiveStatusProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([getSummary(), getIncidents()]).then(([s, i]) => ({ summary: s.data, incidents: i.data })),
    LIVE_INTERVAL_MS,
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  useEffect(() => { if (data && !error) setUpdatedAt(Date.now()); }, [data, error]);

  return (
    <Ctx.Provider value={{
      summary: data?.summary ?? null,
      incidents: data?.incidents ?? null,
      updatedAt,
      stale: !!error,
      loading,
      refresh,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLiveStatus = () => useContext(Ctx);
