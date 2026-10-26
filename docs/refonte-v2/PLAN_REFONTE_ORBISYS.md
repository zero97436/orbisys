# Plan de refonte — Orbisys Application V2

Branche `refonte-app-v2`. Amélioration progressive : chaque lot est compilé, testé (TypeScript, Vitest, build, E2E) et vérifié visuellement dans l'environnement de test isolé avant le suivant. Aucun déploiement sans autorisation.

## Lot 1 — Fondations ✅ terminé

| Livrable | Fichiers | Critère d'acceptation | Statut |
|---|---|---|---|
| Audit | `AUDIT_FRONTEND_ORBISYS.md` | 24 écrans, P0/P1/P2 | ✅ |
| Jetons (couleurs, statuts, typo locale) | `index.css`, `tailwind.config.js`, `public/fonts` | AA en sombre et clair, aucune police externe | ✅ |
| Composants partagés | `ui/Modal`, `ui/Confirm`, `ui/Toast`, `ui/UpgradeNotice`, `States` | Dialogues accessibles (focus, Échap, ARIA) | ✅ |
| Navigation | `lib/nav.ts`, `layout/Sidebar`, `layout/Topbar`, `layout/DashboardLayout`, `CommandPalette` | Groupes, fil d'Ariane, tiroir mobile, Ctrl+K sans lien cassé, verrous d'édition | ✅ |
| État partagé | `lib/liveStatus.tsx`, `lib/license.tsx`, `lib/apiError.ts` | Une requête de statut pour tout le shell ; indicateur hors ligne | ✅ |
| Formatage localisé | `lib/format.ts`, `lib/status.ts` | Dates, durées, % selon la langue de l'app | ✅ |
| Sécurité remédiation (P0-1) | `IncidentCenterPage`, `AlertCard` | Aucune remédiation sans confirmation (test E2E) | ✅ |

## Lot 2 — Supervision

| Priorité | Changement | Fichiers | Critère d'acceptation |
|---|---|---|---|
| P0 | « Hôtes indisponibles » = CRITICAL uniquement ; UNKNOWN séparé | `DashboardPage` | Compteurs cohérents avec `hostBuckets` |
| P1 | Dashboard branché sur `LiveStatusProvider` (rafraîchi), incidents triés par `prioritizeIncidents` | `DashboardPage` | Plus de chargement unique ; pas de double polling |
| P1 | Dispo réelle (`availabilityInWindow`, null = « pas de données ») ; requêtes résultats limitées et tolérantes aux échecs partiels | `DashboardPage`, `lib/series.ts` | Un check en échec ne casse plus la page |
| P1 | `alert()` → toast ; titres traduits | `DashboardPage` | 0 `alert()` |
| P1 | Hôtes : recherche, filtres statut/environnement, tri, pagination ; `getLicense` via `useLicense` | `HostsPage` | Liste utilisable à 500 hôtes |
| P1 | Checks : recherche, filtres, tri ; erreurs affichées ; confirmations `useConfirm` | `ChecksPage`, `CheckDetailPage` | 0 `window.confirm` |
| P1 | Fiche hôte : sections (infos, état, services, métriques, historique, incidents) ; distinguer 404 et erreur | `HostDetailPage` | — |
| P2 | Dates des graphiques dans la langue de l'app | `lib/series.ts`, `charts/*` | — |

## Lot 3 — Exploitation

Liste d'incidents : tri, filtre « non acquittés », durée, actions rapides ; fiche incident (résumé, chronologie, métriques, événements corrélés, analyse IA marquée comme hypothèse, actions, historique) ; maintenance (`useConfirm`) ; tickets et événements avec gestion d'erreur. Mécanismes de déduplication, flapping, escalade et maintenance **inchangés** (backend).

## Lot 4 — Visualisation

Vue NOC : correction `status.` (P0-7), indicateur de déconnexion et heure de dernière mise à jour, tailles adaptées au mur d'écrans, rotation/pagination, plein écran, horloge localisée. Topologie : légende, filtres, recherche, clic vers l'hôte, thème clair, relations réelles uniquement (`parent_host_id`). Opérations : badge « temps réel » retiré ou rafraîchissement réel.

## Lot 5 — IA et administration

Assistant : distinction données observées / analyse / hypothèses / actions proposées / actions exécutées, modèle utilisé, disponibilité d'Ollama. Paramètres : purge de rétention avec `requireText` (P0-5), BrandingPanel réservé aux administrateurs, canaux (validation, test, secrets jamais réaffichés), page licence (édition, statut, expiration, capacités, limites). Reports/Audit/Tenants : `UpgradeNotice` au lieu d'appeler une route absente (P0-4). Connexion : retrait des identifiants préremplis (P0-6). Onboarding guidé (premier équipement, premier contrôle, première notification).

## Lot 6 — Finalisation

Textes restants (annexe A de l'audit), accessibilité (boutons-icônes, labels, tableaux `overflow-x-auto`, statuts non chromatiques), responsive, performances (N+1, polling), tests E2E par module, `TESTS_FRONTEND.md` final.

## Règles transverses

Pas de changement de logique métier pour l'apparence ; pas de déblocage de licence côté client ; pas de données fictives présentées comme réelles ; actions destructives toujours confirmées ; aucune remédiation réelle pendant les tests (routes simulées dans les tests E2E).
