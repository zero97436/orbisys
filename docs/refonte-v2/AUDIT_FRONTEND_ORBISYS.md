# Audit frontend Orbisys (application de supervision)

Branche : `refonte-app-v2`. Audit effectué le 22/10/2026 sur `frontend/src` (pages, composants, `api/`, `hooks/`, `lib/`), recoupé avec le backend (`models/enums.py`, `core/license.py`, `main.py`, `plugins.py`), puis captures d'écran dans un environnement de test isolé (`_install-test`, données de test), en 1440 px et 390 px.

## 1. Stack vérifiée

React 18, TypeScript, Vite, Tailwind 3.4, framer-motion, recharts, React Flow (topologie), Leaflet (carte), axios. Backend FastAPI, PostgreSQL, Redis, Celery, Docker Compose. IA locale : Ollama. Les modules payants (rapports SLA/PDF, audit, multi-tenant, SSO) sont chargés depuis le paquet privé `orbisys-enterprise` : **en Community, leurs routes n'existent pas (404)**, elles ne répondent pas 403.

## 2. Écrans et routes (24)

| Route | Page | Rôle | Remarques principales |
|---|---|---|---|
| `/dashboard` | DashboardPage | Vue d'ensemble | Chargement unique (pas de rafraîchissement), N+1 `listResults` ×24, « hôtes down » compte aussi WARNING/UNKNOWN |
| `/monitoring` | MonitoringPage | Vue live | Pas de gestion d'erreur au rechargement (spinner infini), polling dupliqué |
| `/hosts`, `/hosts/:id` | Hosts, HostDetail | Équipements | Pas de tri/filtre/pagination ; toute erreur du détail affiche « introuvable » |
| `/checks`, `/checks/:id` | Checks, CheckDetail | Contrôles | Pas de recherche ni filtre ; mutations sans gestion d'erreur |
| `/templates` | Templates | Modèles de checks | Pas d'état vide |
| `/incidents` | IncidentCenter | Incidents, IA, remédiation | **Remédiation exécutée sans confirmation** ; polling de commande non arrêté au démontage |
| `/topology` | Topology | Graphe | Mise en page synthétique en colonne, pas de légende/filtre, couleurs sombres figées |
| `/geo` | GeoMap | Carte | Un échec de rafraîchissement remplace la carte |
| `/reports` | Reports | SLA/MTTR/PDF | En Community (404) : rien ne s'affiche, bouton PDF inopérant, spinner infini possible |
| `/operations`, `/bam` | OperationsMap, Bam | Services métier | Badge « temps réel » alors que chargement unique ; glisser-déposer souris uniquement |
| `/apm`, `/containers` | Apm, Containers | APM, Docker | Textes français en dur, pas de gestion d'erreur |
| `/tickets`, `/events` | Tickets, Events | ITSM, journal | Aucune gestion d'erreur (page vide si un appel échoue) |
| `/audit`, `/tenants` | Audit, Tenants | Enterprise/Business | En Community (404) : table vide / CRUD affiché sur listes vides |
| `/assistant`, `/knowledge` | Chat, Knowledge | IA locale, RAG | Pas de distinction observation / hypothèse IA |
| `/settings`, `/docs` | Settings, Docs | Administration, aide | BrandingPanel visible par les lecteurs |
| `/tv` | TvPage | Mur d'écrans | Clé `status.` sans valeur (bug), aucune indication de déconnexion, horloge `fr-FR` figée |
| `/status`, `/login`, `/reset-password` | publiques | — | Identifiants par défaut préremplis sur la page de connexion |

## 3. Problèmes classés

### P0 — sécurité, données trompeuses, actions non maîtrisées
| # | Problème | Fichier | État |
|---|---|---|---|
| P0-1 | Remédiation exécutée en un clic, sans confirmation ; action IA présentée en bouton principal | `AlertCard.tsx`, `IncidentCenterPage.tsx` | **Corrigé (Lot 1)** |
| P0-2 | Hôte sans check compté « OK » | `lib/fleet.ts` | **Corrigé (Lot 1)** : UNKNOWN |
| P0-3 | Palette Ctrl+K : liens `/hosts/` et `/checks/` sans identifiant, clés React dupliquées | `CommandPalette.tsx` | **Corrigé (Lot 1)** |
| P0-4 | Modules payants absents en Community (404) affichés comme vides ou cassés | Reports, Audit, Tenants | **Corrigé** : `FeatureGate` sur les routes, aucune requête vers une route absente |
| P0-5 | Purge de rétention irréversible sans confirmation | `SettingsPage.tsx` | **Corrigé** : confirmation avec mot à retaper, fenêtres affichées |
| P0-6 | Identifiants par défaut préremplis | `LoginPage.tsx` | **Corrigé** |
| P0-7 | TvPage : statut des tuiles vide (`t("status.")`), aucune alerte de déconnexion | `TvPage.tsx` | **Corrigé** : statut, bandeau de déconnexion, erreur au 1er chargement |
| P0-8 | « Hôtes down » inclut WARNING et UNKNOWN | `DashboardPage.tsx` | **Corrigé (Lot 2)** |

| P0-9 | « Dispo 24 h » calculée sur les 200 derniers résultats des 24 premiers checks (≈ 3 h, échantillon partiel) | `DashboardPage.tsx` | **Corrigé (Lot 2)** : calcul serveur |
| P0-10 | Fiche hôte : « Uptime » = ancienneté de l'hôte dans Orbisys ; « dernier contrôle » = dernière modification | `HostCard.tsx`, `fleet.ts` | **Corrigé (Lot 2)** : libellés exacts |

| P0-11 | Remédiation et analyse IA d'un incident sans contrôle du périmètre tenant (un utilisateur cloisonné pouvait agir sur l'hôte d'un autre client) | `backend/app/api/routes/dashboard.py` | **Corrigé (Lot 3)** |
| P0-12 | Résumé IA global calculé sur tous les tenants pour un utilisateur cloisonné ; même défaut dans le contexte du chat IA et l'application d'un plan IA (modification/suppression d'hôtes d'un autre tenant) | `backend/app/services/ai_service.py`, `routes/ai.py`, `routes/dashboard.py` | **Corrigé** |

### P1 — compréhension, erreurs, permissions, i18n
- Mutations sans gestion d'erreur (≈ 15 pages) : rejet de promesse silencieux. Outils prêts : `useToast`, `apiErrorMessage`.
- `window.confirm` / `alert()` partout (12 confirmations natives, 6 alertes). Outils prêts : `useConfirm`, `Modal`, `useToast`.
- Contrôles d'administration visibles par tous : BrandingPanel, TenantsPage.
- Barre latérale plate (21 entrées), sans groupes ni repère d'édition. **Corrigé (Lot 1)**.
- Pas de navigation mobile (barre latérale fixe). **Corrigé (Lot 1)** : tiroir accessible.
- Dates, durées et nombres suivant la langue du navigateur au lieu de celle de l'application (`format.ts`, `series.ts`, Topbar, Tv, Apm). **`format.ts` et Topbar corrigés (Lot 1)** ; `series.ts` et pages : Lot 6.
- Libellés de statut français en dur dans `lib/status.ts`. **Corrigé (Lot 1)**.
- Nombreux textes non traduits dans les pages (liste détaillée en annexe A).
- Polling dupliqué : résumé interrogé par le layout et par les pages, incidents par deux composants. **Shell corrigé (Lot 1)** : `LiveStatusProvider` partagé ; pages : Lot 2/3.
- N+1 `listResults` (Dashboard, OpsMap, Reports, HostDetail).

### P2 — finition, accessibilité, cohérence
- Boutons-icônes sans nom accessible (Checks, Tickets, Bam, Tenants, Knowledge, Templates, Maintenance, Settings, Chat).
- Champs étiquetés seulement par un placeholder.
- Statuts transmis uniquement par la couleur (timeline HostDetail, HealthCard, nœuds de topologie, marqueurs de carte).
- Animations `ping`/`pulse` ignorant `prefers-reduced-motion`. **Corrigé globalement (Lot 1)**.
- Tableaux en `overflow-hidden` qui coupent sur petit écran.
- Motifs dupliqués : 5 tuiles KPI, 8 tables de couleurs, 3 calculs d'état global, 6 tables HTML, 5 champs de recherche.

## 4. Statuts réellement utilisés par le backend

- `CheckStatus` : OK, WARNING, CRITICAL, UNKNOWN (seul statut normalisé).
- Pas d'énumération pour l'état d'un hôte (dérivé côté client : pire statut de ses checks), ni pour la maintenance (dérivée des fenêtres planifiées).
- DOWN et MAINTENANCE n'existent donc pas comme valeurs backend : DOWN = CRITICAL sur un check de disponibilité, MAINTENANCE = fenêtre active. Le design system prévoit le jeton `status-maintenance` pour l'affichage, sans inventer de statut.

## 5. Risques

- Ne pas changer le comportement métier : déduplication, flapping, escalade et maintenance sont côté backend et ne sont pas touchés.
- Licences : le frontend n'affiche que des verrous informatifs ; le backend reste seul juge (403).
- Les pages non encore migrées continuent d'utiliser les anciens composants : la refonte est progressive et chaque lot est testé.

## Annexe A — textes non traduits relevés

Dashboard (`"Dashboard"`, libellés KPI, `"Health Overview"`), Hosts/Checks (titres, `"Run"`), HostDetail (`"24 h"/"30 j"`, `"Aucun événement."`), CheckDetail (`"timeout"`, `"Perfdata"`), Incident (`"Critical"/"Warning"`), Tv (`"Chargement…"`, `"Quitter le mode TV"`), Apm (paragraphes FR, `"Actualiser"`), OperationsMap (`"composants OK"`, couches), Bam (catégories), GeoMap, Containers, Settings, Login (`"ou"`), Chat, LiveEventFeed (`"Live Monitoring"`), SystemHealthCard, graphiques (`"Disponibilité"`, `"Valeur"`, `"Temps de réponse"`), DiscoveryPanel.
