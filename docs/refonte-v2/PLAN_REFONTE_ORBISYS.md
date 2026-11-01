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

## Lot 2 — Supervision ✅ terminé

| Priorité | Changement | Fichiers | Statut |
|---|---|---|---|
| P0 | « Hôtes critiques » = CRITICAL uniquement (WARNING/UNKNOWN ne comptent plus comme « down ») | `DashboardPage` | ✅ |
| P0 | Disponibilité réelle calculée par le serveur sur toute la fenêtre (24 h / 7 j / 30 j), `null` = « aucune mesure » | `GET /dashboard/availability` (nouveau), `DashboardPage`, `CheckDetailPage` | ✅ |
| P1 | Dashboard rafraîchi (LiveStatusProvider + polling 30/60 s), incidents priorisés, `alert()` → toast, réinitialisation confirmée | `DashboardPage` | ✅ |
| P1 | Hôtes : recherche, filtres état/environnement, tri, pagination, vue tableau/cartes, formulaire en panneau avec labels et validation | `HostsPage`, `hosts/HostForm`, `ui/ListControls` | ✅ |
| P1 | Checks : recherche, filtres état/type/hôte (`?host=`), tri, pagination, exécution avec résultat, confirmations, validation JSON/nombres | `ChecksPage`, `checks/CheckForm` | ✅ |
| P1 | Fiche hôte : incidents liés, actions (modifier, gérer les checks), 404 distinguée, rafraîchissement, statut honnête | `HostDetailPage` | ✅ |
| P1 | Vue Monitoring : gestion d'erreur, tri par gravité, flux partagé | `MonitoringPage`, `lib/liveStatus`, `hooks/useLiveEvents` | ✅ |
| P2 | Dates des graphiques dans la langue de l'app, axes non tronqués | `lib/series.ts`, `charts/*` | ✅ |

Reporté (nécessite une évolution backend) : « dernier contrôle » par hôte — le modèle `Check` n'a pas de `last_checked_at` (migration à prévoir).

## Lot 3 — Exploitation ✅ terminé

| Priorité | Changement | Fichiers | Statut |
|---|---|---|---|
| P0 | **Sécurité** : remédiation et analyse IA vérifient désormais le périmètre tenant (404 hors périmètre), comme l'acquittement | `routes/dashboard.py`, `tests/test_incident_scope.py` | ✅ |
| P1 | Fiche incident (panneau, lien partageable `?open=`) : résumé, impact (dépendances déclarées), incidents corrélés, temps de réponse, analyse IA présentée comme hypothèse, actions exécutées, chronologie issue du journal | `incidents/IncidentDetail`, `IncidentCenterPage` | ✅ |
| P1 | Liste : KPI traduits, filtre « non acquittés », tri (priorité / ancienneté), durée lisible, erreurs affichées | `IncidentCenterPage`, `AlertCard` | ✅ |
| P1 | Maintenance : libellés, validation fin > début, confirmation de suppression, état « terminée » (auparavant affiché « planifiée ») | `MaintenancePanel` | ✅ |
| P1 | Tickets : erreurs affichées, confirmations (ticket, tâche, suivi), boutons toujours visibles et nommés, recherche, lien vers l'incident | `TicketsPage` | ✅ |
| P1 | Journal : erreur + réessayer, types d'événements manquants traduits, liens hôte/check, portée de la recherche explicitée | `EventsPage` | ✅ |
| P1 | Dialogues empilés : seul le dialogue du dessus réagit au clavier | `ui/Modal` | ✅ |
| — | `GET /events?check_id=` (ajout rétrocompatible) pour la chronologie | `routes/events.py`, `event_service.py` | ✅ |

Inchangé (backend) : déduplication, flapping, escalade, suppression par dépendance et maintenance.

Reporté : le résumé IA global (`POST /dashboard/ai-summary`) agrège tous les tenants pour un utilisateur cloisonné — correction à faire dans `AIService` (Lot 5).

## Correctifs P0 anticipés ✅ (31/10/2026)

Les cinq P0 restants de l'audit ont été traités avant le Lot 4 : P0-4 (modules hors édition), P0-5 (purge), P0-6 (identifiants préremplis), P0-7 (mode TV : statut des tuiles, perte de connexion, plein écran, horloge localisée), P0-12 (cloisonnement tenant de toute l'IA : résumé, chat, application de plan). Le Lot 4 reprend la vue NOC à partir de cette base.

## Lot 4 — Visualisation ✅ terminé

| Priorité | Changement | Fichiers | Statut |
|---|---|---|---|
| P0 | Vue NOC : statut des tuiles, bandeau de perte de connexion, plein écran, horloge localisée, « + N autres » (voir correctifs P0) | `TvPage` | ✅ |
| P1 | Topologie : suppression des liens fictifs (nœud « Orbisys » → environnements → hôtes) ; environnements en cadres de regroupement, seules les dépendances déclarées (`parent_host_id`) sont reliées, disposition en couches parent → enfant | `TopologyPage` | ✅ |
| P1 | Topologie : filtres (état, environnement, dépendances seules), recherche avec mise en évidence, légende, minimap au-delà de 30 hôtes, rendu limité au visible, clic vers la fiche hôte, thème clair, statut en texte dans chaque nœud | `TopologyPage` | ✅ |
| P1 | Carte des opérations : rafraîchissement réel 30 s (figé pendant l'édition), heure de mise à jour au lieu du badge « temps réel », tendance 24 h serveur (au lieu de 16 checks), déplacement au clavier, réinitialisation confirmée, erreurs affichées | `OperationsMapPage` | ✅ |
| P1 | KPI trompeurs : « 0/0 » vert sans service métier, « Hôtes en ligne » qui comptait les hôtes sains | `OperationsMapPage` | ✅ |

## Lot 5 — IA et administration ✅ terminé

| Priorité | Changement | Fichiers | Statut |
|---|---|---|---|
| P0 | Cloisonnement tenant de toute l'IA (résumé, chat, plans) — voir correctifs P0 | `ai_service.py`, `routes/ai.py` | ✅ |
| P1 | Assistant : état du modèle local (`GET /ai/status`), réponses marquées « générées par l'IA — à vérifier » avec l'heure de l'état utilisé, plans toujours confirmés (mot à retaper si suppression), « exécuté » distinct de « proposé » | `ChatPage`, `routes/ai.py` | ✅ |
| P1 | Licence : `key_status` (aucune / valide / expirée / invalide, jamais la clé), carte Licence (édition, expiration et alerte 30 j, quota, fonctionnalités par édition, activation) | `LicenseCard`, `core/license.py`, `routes/hosts.py` | ✅ |
| P1 | Canaux : suppression (`DELETE`), formulaire par champs avec validation (plage horaire invalide = 24 h/24 silencieusement auparavant), secrets jamais réaffichés, édition requise, test d'envoi | `ChannelsCard`, `routes/settings.py` | ✅ |
| P1 | Image de marque réservée aux administrateurs, réinitialisation confirmée ; purge, utilisateurs et rôles confirmés | `SettingsPage`, `BrandingPanel` | ✅ |
| P1 | Plus aucun `alert()` / `window.confirm` dans l'application | Métier, Connaissances, Templates, Tenants, Rapports | ✅ |
| P1 | Premiers pas : 4 étapes calculées sur les données réelles (hôte, check, canal, résultats), action directe, masquables | `GettingStarted`, `DashboardPage` | ✅ |

## Lot 6 — Finalisation ✅ terminé

| Priorité | Changement | Fichiers | Statut |
|---|---|---|---|
| P1 | Textes restants traduits (APM, carte, conteneurs, connexion, graphiques, connaissances, rapports, couches et icônes métier) | 10 fichiers, 36 clés | ✅ |
| P1 | Accessibilité WCAG 2.0/2.1/2.2 A et AA : 0 violation axe-core sur les 23 pages, thèmes sombre et clair (7 règles en échec au départ) | jetons de couleur, `Topbar`, `DashboardPage`, `StatusDonut`, listes déroulantes | ✅ |
| P1 | Mouvement réduit respecté par framer-motion (plus de fondu d'entrée) | `App.tsx`, `ui/Card.tsx` | ✅ |
| P1 | Mobile 390 px : aucune page ne défile horizontalement (le texte `sr-only` des tableaux s'échappait de la zone de défilement : +321 px) ; en-tête du mode TV adaptatif | `HostsPage`, `ChecksPage`, `TvPage` | ✅ |
| P1 | Performance : Rapports calculés par le serveur (3 requêtes au lieu de 31, 15 000 lignes en moins) | `ReportsPage` | ✅ |
| — | Tests E2E d'accessibilité (par thème) et de débordement mobile ajoutés à la suite | `e2e/app.spec.ts` | ✅ |

## Suites possibles (hors périmètre de la mission)

| Sujet | Pourquoi | Effort |
|---|---|---|
| `last_checked_at` sur les checks | Afficher « dernier contrôle » par hôte (absent du modèle) | Migration + champ |
| Notifications temps réel (WebSocket/SSE) | Remplacer l'interrogation périodique (10 à 60 s) | Moyen |
| Formulaires restants à libellés visibles | Tenants, Connaissances, filtres d'audit : nom accessible via le texte indicatif (conforme axe, mais un libellé visible est préférable) | Faible |
| Fiche hôte : historique par check | Encore une requête par check de l'hôte (borné, acceptable) | Faible (endpoint groupé) |
| Fournisseur de fonds de carte | Usage commercial à grande échelle (OpenStreetMap : usage modéré) | Configuration |
| Chromium Playwright | E2E exécutés avec Edge sur ce poste ; installer Chromium pour la CI | Faible |

## Règles transverses

Pas de changement de logique métier pour l'apparence ; pas de déblocage de licence côté client ; pas de données fictives présentées comme réelles ; actions destructives toujours confirmées ; aucune remédiation réelle pendant les tests (routes simulées dans les tests E2E).
