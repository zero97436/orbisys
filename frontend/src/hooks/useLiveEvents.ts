import { useLiveStatus, type LiveEvent } from "../lib/liveStatus";

export type { LiveEvent };

/**
 * Flux d'événements temps réel (apparition, changement, résolution d'incidents).
 * Dérivé du relevé partagé de LiveStatusProvider : aucune requête supplémentaire,
 * pause quand l'onglet est masqué, historique conservé entre les pages.
 * Le backend n'expose pas de WebSocket ; cette abstraction pourra s'y brancher
 * sans changer les composants consommateurs.
 */
export function useLiveEvents() {
  const { events, stale, updatedAt } = useLiveStatus();
  return { events, connected: !stale && updatedAt != null };
}
