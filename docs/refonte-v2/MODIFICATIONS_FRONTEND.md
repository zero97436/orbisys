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
