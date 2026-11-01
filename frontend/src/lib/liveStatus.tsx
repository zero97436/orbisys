/** État de supervision partagé par le shell et les pages (résumé + incidents actifs).
 *  Une seule requête périodique au lieu d'une par composant ; pause quand l'onglet est
 *  masqué (usePolling). La fréquence d'affichage ne touche pas la supervision elle-même.
 *  Le flux d'événements (apparition / changement / résolution d'incidents) est dérivé ici,
 *  par différence entre deux relevés, et survit donc à la navigation entre pages. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getIncidents, getSummary } from "../api/endpoints";
import { usePolling } from "../hooks/usePolling";
import type { CheckStatus, DashboardSummary, Incident } from "../types";

export interface LiveEvent {
  id: string;
  kind: "new" | "resolved" | "changed";
  hostName: string;
  checkName: string;
  status: CheckStatus;
  message?: string | null;
  at: number;
}

interface LiveStatus {
  summary: DashboardSummary | null;
  incidents: Incident[] | null;
  /** Événements récents (le plus récent d'abord), depuis l'ouverture de la session. */
  events: LiveEvent[];
  /** Dernière mise à jour réussie (ms). */
  updatedAt: number | null;
  /** true si la dernière tentative a échoué (backend injoignable / déconnexion). */
  stale: boolean;
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<LiveStatus>({
  summary: null, incidents: null, events: [], updatedAt: null, stale: false, loading: true, refresh: () => {},
});

export const LIVE_INTERVAL_MS = 20000;
const MAX_EVENTS = 40;

let seq = 0;
function evt(kind: LiveEvent["kind"], inc: Incident, at: number): LiveEvent {
  return {
    id: `${kind}-${inc.alert_id}-${at}-${++seq}`,
    kind,
    hostName: inc.host_name,
    checkName: inc.check_name,
    status: inc.status,
    message: inc.message,
    at,
  };
}

/** Différence entre deux relevés d'incidents -> événements. Exportée pour les tests. */
export function diffIncidents(before: Incident[], after: Incident[], at = Date.now()): LiveEvent[] {
  const prev = new Map(before.map((i) => [i.alert_id, i]));
  const next = new Map(after.map((i) => [i.alert_id, i]));
  const out: LiveEvent[] = [];
  for (const [id, inc] of next) {
    const old = prev.get(id);
    if (!old) out.push(evt("new", inc, at));
    else if (old.status !== inc.status) out.push(evt("changed", inc, at));
  }
  for (const [id, inc] of prev) if (!next.has(id)) out.push(evt("resolved", { ...inc, status: "OK" }, at));
  return out;
}

export function LiveStatusProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, refresh } = usePolling(
    () => Promise.all([getSummary(), getIncidents()]).then(([s, i]) => ({ summary: s.data, incidents: i.data })),
    LIVE_INTERVAL_MS,
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const prev = useRef<Incident[] | null>(null);

  useEffect(() => {
    if (!data || error) return;
    setUpdatedAt(Date.now());
    // Premier relevé : référence, pas d'événement (on ne « découvre » pas l'existant).
    if (prev.current) {
      const fresh = diffIncidents(prev.current, data.incidents);
      if (fresh.length) setEvents((e) => [...fresh, ...e].slice(0, MAX_EVENTS));
    }
    prev.current = data.incidents;
  }, [data, error]);

  return (
    <Ctx.Provider value={{
      summary: data?.summary ?? null,
      incidents: data?.incidents ?? null,
      events,
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
