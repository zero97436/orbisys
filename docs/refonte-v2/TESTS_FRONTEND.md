# Tests frontend — Orbisys Application V2

Environnement : environnement de test isolé (`_install-test/orbisys`, Docker, données de test), serveur Vite local `:5173`. Aucune donnée de production, aucun déploiement.

## Lot 1 — 26/10/2026

| Vérification | Commande | Résultat |
|---|---|---|
| TypeScript | `npx tsc -b` | ✅ 0 erreur |
| Tests unitaires | `npx vitest run` | ✅ 14/14 (2 fichiers) |
| Build de production | `npx vite build` | ✅ |
| E2E | `E2E_BASE_URL=http://localhost:5173 npx playwright test` (canal Edge) | ✅ 8/8 |

### Tests unitaires ajoutés (`src/lib/foundations.test.ts`)
- Hôte sans check = UNKNOWN ; hôte = pire statut de ses checks ; répartition par état.
- État global (CRITICAL > WARNING > OK, UNKNOWN sans données).
- Priorisation des incidents (gravité, non acquittés, ancienneté).
- Disponibilité : `null` sans échantillon (pas de 100 % inventé), fenêtre respectée.
- `timeAgo`, `formatDuration`, `formatPercent` en FR et EN.
- Navigation : routes uniques, libellés traduits FR/EN pour chaque entrée et groupe ; résolution des pages de détail.
- `apiError` : refus de licence, erreur réseau, refus de droits.

### Tests E2E (`e2e/app.spec.ts`, réécrit)
L'ancienne suite échouait avant la refonte (textes « Hosts Online » disparus, langue dépendante du navigateur). Nouvelle suite, langue fixée :
1. Connexion et dashboard (état global annoncé en texte).
2. Identifiants invalides.
3. Navigation groupée, fil d'Ariane, `aria-current`.
4. Palette Ctrl+K : ouverture, recherche, Entrée, Échap.
5. Changement de langue FR → EN (`<html lang>` mis à jour).
6. Mobile 390 px : tiroir de navigation, fermeture à la navigation, aucun débordement horizontal.
7. Redirection vers la connexion sans session.
8. **Remédiation : rien n'est exécuté sans confirmation** — routes d'analyse et de remédiation simulées (`[TEST]`), aucune requête vers le backend ; Annuler = 0 appel, Exécuter = 1 appel.

### Vérification visuelle
Captures (`_tools/shell-shots.js`) : dashboard sombre FR 1440 px, incidents clair EN, fiche hôte, palette, mobile 390 px et tiroir. Aucune erreur JS. Deux réponses 404 attendues : `/api/auth/sso/info` (SSO = Enterprise, absent en Community, géré par la page de connexion).

## Lot 2 — 31/10/2026

| Vérification | Résultat |
|---|---|
| TypeScript, build | ✅ |
| Vitest | ✅ 17/17 (ajout `liveStatus.test.ts` : détection apparition / changement / résolution) |
| E2E (Edge) | ✅ 13/13 |
| Pytest backend complet | ✅ 211 réussis, 2 ignorés (chiffre corrigé le 31/10 : la première version de ce document indiquait 213 sans résumé vérifié) |

E2E ajoutés : disponibilité serveur et changement de période ; hôtes (filtre d'état, tri, suppression annulée = 0 requête DELETE) ; checks (validation locale = 0 requête POST ; filtre `?host=`) ; fiche hôte 404.

Note : `tests/test_ssh_command.py::test_unreachable_is_critical` échoue sur un Python local sans `paramiko` (le check répond UNKNOWN « paramiko non installé »). Dans l'image Docker (paramiko 3.4.1 installé) le check renvoie bien CRITICAL. Problème d'environnement, pas de régression.

## Lot 3 — 31/10/2026

| Vérification | Résultat |
|---|---|
| TypeScript, build | ✅ |
| Vitest | ✅ 17/17 |
| E2E (Edge) | ✅ 17/17 |
| Pytest backend complet | ✅ 213 réussis, 2 ignorés (résumé pytest vérifié) |

E2E ajoutés ou modifiés :
- Remédiation : l'analyse s'ouvre dans la fiche (mention « hypothèse ») ; Annuler et Échap sur la confirmation ne ferment pas la fiche ; 0 appel avant confirmation, 1 après.
- Fiche incident : chronologie et analyse présentes, réouverture depuis l'URL, fermeture par Échap.
- Liste d'incidents : tri par priorité, filtre « non acquittés », tri par récence (données simulées `[TEST]`).
- Maintenance : fin avant début refusée sans requête.
- Tickets : création d'un ticket `[TEST]`, tâche, suppression annulée puis ticket supprimé avec confirmation (nettoyage).

Pytest ajoutés : cloisonnement tenant des actions sur incident (reproduisait la faille avant correction : l'analyse d'un incident d'un autre tenant était lancée) ; filtre `check_id` du journal.

## Correctifs P0 — 31/10/2026

| Vérification | Résultat |
|---|---|
| TypeScript, build | ✅ |
| Vitest | ✅ 17/17 |
| E2E (Edge) | ✅ 21/21 |
| Pytest backend complet | ✅ 215 réussis, 2 ignorés |

- Pytest : `test_ai_summary_only_sees_own_tenant` (échouait avant correction : l'hôte d'un autre tenant était envoyé au modèle), `test_ai_chat_and_plan_stay_in_tenant` (contexte du chat et suppression d'un hôte étranger via plan).
- E2E : connexion sans identifiants préremplis ; modules hors édition sans requête vers une route absente (licence Community simulée) ; purge verrouillée sans le mot de confirmation exact ; mode TV (statut des tuiles, bandeau de perte de connexion).
- Vérifié dans l'environnement de test (licence Community réelle) : 0 requête vers `/api/reports|audit|tenants` après correction du chargement de la licence dans `FeatureGate`.

## Problèmes restants (lots suivants)
- Pages non encore migrées : `alert()`/`window.confirm` subsistent (Bam, Knowledge, Templates, Tenants, Reports, Chat).
- Le navigateur Playwright Chromium n'est pas installé sur ce poste : E2E exécutés avec Edge (`channel: "msedge"`). L'ancien Playwright de `_tools/` ne lance plus Edge (mode headless retiré) : utiliser celui de `frontend/node_modules`.
