# Modifications frontend — Orbisys Application V2

Branche `refonte-app-v2`. Aucun contrat d'API modifié ; aucune règle de supervision, d'alerte, de permission ou de licence modifiée.

## Lot 1 — Fondations

### Design system
| Fichier | Changement | Justification | Risque de régression |
|---|---|---|---|
| `index.css`, `tailwind.config.js` | Palette bleu nuit par variables, variantes claires, statuts par thème (dont `info`, `maintenance`), classes `.btn-*`, `.icon-btn`, `.input`, `.label`, `.chip`, `.table-std`, focus visible global, mouvement réduit, animation `page-enter` | Cohérence, contraste AA, accessibilité | Faible : classes existantes conservées |
| `public/fonts/*` | Schibsted Grotesk et JetBrains Mono auto-hébergées (OFL) | Identité, pas d'appel externe (self-hosted) | Aucun |
| `components/ui/Modal.tsx` (nouveau) | Dialogue accessible, variantes centre/tiroir | Aucune modale n'existait | — |
| `components/ui/Confirm.tsx` (nouveau) | `useConfirm()` : remplace `window.confirm` | Confirmations explicites, cible affichée, ton danger | — |
| `components/ui/Toast.tsx` (nouveau) | `useToast()` : remplace `alert()` | Retour non bloquant, annoncé aux lecteurs d'écran | — |
| `components/ui/UpgradeNotice.tsx` (nouveau) | Explication « module réservé à l'édition X » | Licences explicites, sans contournement | — |
| `components/States.tsx` | `ErrorState` avec « Réessayer », `EmptyState` avec titre/icône/action, rôles ARIA | États vides utiles | Faible : props historiques conservées |
| `components/ui/StatusBadge.tsx` | `StatusDot` avec `label` accessible, ping désactivé en mouvement réduit | Statut jamais par la couleur seule | Aucun |
| `components/ui/Logo.tsx` | Identifiants de dégradés SVG uniques (`useId`) | **Bug** : logo vide dans le tiroir mobile (identifiants dupliqués pointant vers un SVG masqué) | Aucun |

### Navigation et shell
| Fichier | Changement | Justification |
|---|---|---|
| `lib/nav.ts` (nouveau) | Modèle unique (6 groupes, 21 modules existants, `feature` sous licence) | Sidebar, fil d'Ariane et palette synchronisés |
| `layout/Sidebar.tsx` | Groupes, cadenas d'édition, repli, `MobileNav` (tiroir accessible) | Navigation lisible ; mobile inexistant auparavant |
| `layout/Topbar.tsx` | Menu mobile, état global (icône + texte), indicateur **Hors ligne**, fil d'Ariane, compteur d'incidents non acquittés, sélecteurs langue/thème `aria-pressed`, horloge localisée | Visibilité immédiate, accessibilité |
| `layout/DashboardLayout.tsx` | `LicenseProvider`, `LiveStatusProvider`, lien d'évitement, `<main id="main">`, largeur max | Polling unique pour le shell |
| `CommandPalette.tsx` | Réécrit : modules depuis `nav.ts` (verrous inclus), liens `/hosts/:id` et `/checks/:id` corrigés, clés uniques, combobox/listbox ARIA, statut texte + icône, retour du focus | **Bugs** : liens sans identifiant, clés dupliquées, aucune sémantique de dialogue |
| `App.tsx` | `ToastProvider`, `ConfirmProvider` | Disponibles dans toute l'application |

### Données et formatage
| Fichier | Changement | Justification |
|---|---|---|
| `lib/liveStatus.tsx` (nouveau) | Résumé + incidents partagés, 20 s, pause onglet masqué | Supprime le polling du layout ; base pour les pages |
| `lib/license.tsx` (nouveau) | Édition et fonctionnalités (`GET /hosts/license`), `has()` d'affichage | Verrous informatifs ; le backend reste seul juge |
| `lib/apiError.ts` (nouveau) | Lecture uniforme des erreurs (statut, `detail`, refus de licence, réseau) | Remplace ~12 casts dispersés |
| `lib/fleet.ts` | Hôte sans check = UNKNOWN ; `overallStatus`, `hostBuckets`, `prioritizeIncidents`, `availabilityInWindow` (null sans échantillon) | **Donnée trompeuse** corrigée ; logique d'état unique |
| `lib/format.ts` | `localeOf`, `timeAgo`/`formatDuration`/`formatPercent` dans la langue de l'app | Dates et nombres suivaient le navigateur |
| `lib/status.ts` | Libellé de statut traduit dynamiquement | Libellés français en dur |
| `hooks/usePolling.ts` | Message d'erreur traduit, données précédentes conservées en cas d'échec | Écran lisible et marqué non à jour |
| `lib/i18n.tsx` | Clés shell, licence, confirmation, remédiation (FR/EN) | — |

### Sécurité des actions
| Fichier | Changement | Justification |
|---|---|---|
| `pages/IncidentCenterPage.tsx` | Confirmation obligatoire avant toute remédiation (action, cible hôte/check, mention « hypothèse IA ») ; erreurs d'acquittement et de ticket affichées ; intervalles de suivi de commande arrêtés au démontage | **P0** : exécution en un clic ; fuite d'intervalles |
| `components/ui/AlertCard.tsx` | Action suggérée par l'IA en bouton secondaire marqué « suggestion IA » | Une hypothèse IA n'est pas présentée comme la bonne action |

Comportement backend de la remédiation inchangé (droits, licence `remediation`, exécution par l'agent).

## Lot 2 — Supervision

### Backend (ajout, aucun contrat existant modifié)
| Fichier | Changement | Justification | Risque |
|---|---|---|---|
| `app/services/dashboard_service.py`, `app/api/routes/dashboard.py` | `GET /api/dashboard/availability?hours=&buckets=&check_id=` : % de résultats OK, global et par tranche, sur les checks visibles (cloisonnement tenant appliqué) | Même formule que l'affichage précédent, mais sur **tous** les résultats de la fenêtre au lieu d'un échantillon tronqué ; supprime 24 requêtes N+1 | Faible : lecture seule, requêtes agrégées indexées (`checked_at`) |
| `tests/test_dashboard_availability.py` | 4 tests (fenêtre, bornes, absence de données, filtre par check) | — | — |

### Frontend
| Fichier | Changement | Justification |
|---|---|---|
| `pages/DashboardPage.tsx` | Réécrit : LiveStatusProvider, disponibilité serveur avec période 24 h / 7 j / 30 j, KPI cliquables et traduits, « hôtes critiques » corrects, incidents priorisés, filtre « à traiter » de la flotte, état vide avec action, toasts et confirmation | Données exactes et à jour ; P0-8, P0-9 |
| `pages/HostsPage.tsx`, `components/hosts/HostForm.tsx` | Tableau triable/filtrable/paginé + vue cartes ; formulaire en panneau latéral, sections, labels, validation (coordonnées, port), erreurs serveur (quota) dans le formulaire ; mot de passe SSH jamais réaffiché, vide = conservé | Liste exploitable à grande échelle ; plus de piège de suppression du mot de passe |
| `pages/ChecksPage.tsx`, `components/checks/CheckForm.tsx` | Idem ; filtre `?host=` ; exécution manuelle avec résultat en toast ; validation JSON / nombres alignée sur le backend (intervalle ≥ 5 s) ; sondes distribuées marquées « Business » | Plus de `alert()`, plus d'erreurs silencieuses |
| `pages/HostDetailPage.tsx` | Incidents liés, actions, parent cliquable, 404 vs erreur réseau, rafraîchissement 30 s, historique avec statut en texte | Fiche d'intervention |
| `pages/CheckDetailPage.tsx` | Disponibilité 24 h serveur, textes traduits, erreurs d'exécution affichées | Chiffre exact |
| `pages/MonitoringPage.tsx`, `lib/liveStatus.tsx`, `hooks/useLiveEvents.ts`, `components/live/LiveEventFeed.tsx` | Flux d'événements dérivé du relevé partagé (plus de polling 8 s séparé, historique conservé entre pages), gestion d'erreur, `role="log"` | Performance, accessibilité |
| `components/ui/ListControls.tsx` (nouveau) | `SearchInput`, `FilterChips`, `Pagination`, `paginate` | Remplace 5 copies de champ de recherche |
| `components/ui/Modal.tsx` | `onClose` lu via ref | **Bug** : le focus sautait au premier champ à chaque rendu du parent (rafraîchissement, saisie) |
| `components/ui/HostCard.tsx`, `lib/fleet.ts` | « Supervisé depuis » au lieu d'« Uptime » ; suppression du faux « dernier contrôle » | Donnée trompeuse (P0-10) |
| `lib/series.ts`, `charts/*` | Tranches vides = `null` (trou), libellés localisés, marges d'axes | Plus de 100 % fictif, axes lisibles |
| `pages/GeoMapPage.tsx`, `index.css` | Fond OpenStreetMap (CARTO exige désormais une clé), thème sombre par filtre, URL configurable validée | Carte affichée à nouveau |

## Lot 3 — Exploitation

### Backend
| Fichier | Changement | Justification | Risque |
|---|---|---|---|
| `app/api/routes/dashboard.py` | `remediate` et `analyze` appellent `_assert_alert_visible` (déjà utilisé par `ack`/`unack`) ; `analyze` reçoit l'utilisateur courant | **Faille de cloisonnement** : actions possibles sur un incident d'un autre tenant | Nul hors multi-tenant (`is_scoped` = faux) |
| `app/api/routes/events.py`, `app/services/event_service.py` | Paramètre facultatif `check_id` | Chronologie d'un incident depuis le journal existant | Nul : paramètre optionnel |
| `tests/test_incident_scope.py`, `tests/test_events.py` | Tests de cloisonnement (ack/analyse/remédiation → 404) et de filtre | — | — |

### Frontend
| Fichier | Changement | Justification |
|---|---|---|
| `components/incidents/IncidentDetail.tsx` (nouveau) | Fiche incident en panneau latéral, uniquement des données enregistrées ; IA étiquetée « hypothèse » ; actions exécutées lues dans le journal | Mission §9 et §10 |
| `pages/IncidentCenterPage.tsx` | Fiche ouvrable par URL, filtre non acquittés, tri, KPI traduits, erreurs affichées, rafraîchissement de l'état partagé après action | Lisibilité, partage d'un incident entre opérateurs |
| `components/ui/AlertCard.tsx` | « depuis 3 j 2 h » + date exacte au survol, bouton « Détails » | Durée lisible |
| `components/MaintenancePanel.tsx` | Réécrit : libellés, validation, confirmation, phases (en cours / planifiée / terminée) | Bug d'affichage des maintenances terminées |
| `pages/TicketsPage.tsx` | Erreurs, confirmations, accessibilité, recherche, lien incident | Audit §4, §6, §7 |
| `pages/EventsPage.tsx` | Erreur + réessayer, nouveaux types, liens, portée de recherche | Audit §1, §5 |
| `components/ui/Modal.tsx` | Pile de dialogues | Échap fermait la fiche et la confirmation ensemble |
| `components/charts/ResponseTimeChart.tsx` | Légende traduite | i18n |

## Correctifs P0

| Fichier | Changement | Justification | Risque |
|---|---|---|---|
| `backend/app/services/ai_service.py`, `routes/ai.py`, `routes/dashboard.py` | `health_summary`, `chat` et `_state_snapshot` limités au périmètre de l'utilisateur ; `apply_plan` ignore toute opération sur un hôte/check hors périmètre et rattache un hôte créé au tenant de l'utilisateur | Fuite et modification possibles entre clients (P0-12) | Nul hors multi-tenant |
| `frontend/src/components/ui/UpgradeNotice.tsx` (`FeatureGate`), `App.tsx` | Rapports, Audit, Tenants : la page n'est montée que si l'édition couvre la fonction ; sinon explication de l'édition requise | P0-4 : pages vides/cassées et appels 404 en Community | Faible : licence illisible = page affichée, backend juge |
| `frontend/src/pages/SettingsPage.tsx` | Purge : confirmation avec mot à retaper et fenêtres de rétention ; suppression d'utilisateur et de rôle confirmées ; plus aucun `alert()` | P0-5, règle n°13 | — |
| `frontend/src/pages/LoginPage.tsx` | Champs vides, `htmlFor`/`autocomplete`, messages annoncés | P0-6, accessibilité | Le compte initial reste documenté dans le README |
| `frontend/src/pages/TvPage.tsx` | Réécrit : statut des tuiles, bandeau de perte de connexion avec heure des données, écran d'erreur au premier chargement, plein écran, horloge localisée, « + N autres », polices agrandies | P0-7 | — |

## Lot 4 — Visualisation

| Fichier | Changement | Justification |
|---|---|---|
| `pages/TopologyPage.tsx` | Réécrit : nœuds personnalisés (icône + texte de statut), cadres d'environnement, arêtes = dépendances déclarées uniquement (rouges si le parent est critique), couches parent → enfant, filtres, recherche, légende, minimap, clic vers l'hôte, couleurs par variables de thème | La mission interdit une topologie fictive ; l'ancienne disposition en colonne unique faisait passer un lien derrière un autre hôte (lecture fausse) |
| `pages/OperationsMapPage.tsx` | `usePolling` 30 s, liste figée pendant l'édition, `GET /dashboard/availability` pour la tendance, flèches pour déplacer, confirmation de réinitialisation, toasts d'erreur, KPI corrigés, textes traduits | Badge « temps réel » sans rafraîchissement ; N+1 ; glisser-déposer souris seulement |
| `pages/TvPage.tsx` | Voir correctifs P0 | — |
