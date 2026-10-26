import type { Check, CheckResult, CheckStatus, Host, Incident } from "../types";
import { worstStatus } from "./status";
import type { HostView } from "../components/ui/HostCard";

/** Combine hôtes + checks pour produire des HostView avec statut agrégé.
 *  Un hôte sans aucun check est « UNKNOWN » (rien ne prouve qu'il va bien). */
export function buildHostViews(hosts: Host[], checks: Check[]): HostView[] {
  const byHost = new Map<number, Check[]>();
  for (const c of checks) {
    const arr = byHost.get(c.host_id) ?? [];
    arr.push(c);
    byHost.set(c.host_id, arr);
  }
  return hosts.map((h) => {
    const hc = byHost.get(h.id) ?? [];
    return {
      ...h,
      status: hc.length ? worstStatus(hc.map((c) => c.last_status ?? "UNKNOWN")) : "UNKNOWN",
      checksCount: hc.length,
    };
  });
}

/** Ordre de gravité (tri : le plus grave d'abord). */
export const SEVERITY_RANK: Record<CheckStatus, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, OK: 3 };

/** État global à partir des compteurs de checks du backend. */
export function overallStatus(counts: Partial<Record<CheckStatus, number>>): CheckStatus {
  if ((counts.CRITICAL ?? 0) > 0) return "CRITICAL";
  if ((counts.WARNING ?? 0) > 0) return "WARNING";
  if ((counts.OK ?? 0) > 0) return "OK";
  return "UNKNOWN";
}

/** Répartition des hôtes par état agrégé (un hôte = son check le plus grave). */
export function hostBuckets(views: { status: CheckStatus }[]): Record<CheckStatus, number> {
  const b: Record<CheckStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0, UNKNOWN: 0 };
  for (const v of views) b[v.status] += 1;
  return b;
}

/** Incidents triés pour l'action : gravité, puis non acquittés, puis les plus anciens d'abord
 *  (un incident ouvert depuis longtemps est plus urgent qu'un incident de la minute). */
export function prioritizeIncidents(list: Incident[]): Incident[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] ||
      Number(a.acknowledged) - Number(b.acknowledged) ||
      +new Date(a.since) - +new Date(b.since),
  );
}

/** Disponibilité (% de résultats OK) sur une fenêtre réelle se terminant maintenant.
 *  Retourne null s'il n'y a aucun résultat dans la fenêtre (pas de 100 % par défaut). */
export function availabilityInWindow(results: CheckResult[], windowMs: number, now = Date.now()): { ratio: number | null; samples: number } {
  const start = now - windowMs;
  let ok = 0, total = 0;
  for (const r of results) {
    const ts = new Date(r.checked_at).getTime();
    if (ts < start || ts > now) continue;
    total += 1;
    if (r.status === "OK") ok += 1;
  }
  return { ratio: total ? Math.round((ok / total) * 1000) / 10 : null, samples: total };
}
