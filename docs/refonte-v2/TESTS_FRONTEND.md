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

## Problèmes restants (lots suivants)
- Pages non encore migrées : `alert()`/`window.confirm` subsistent (Dashboard, Checks, Settings, Tickets, Bam, Knowledge, Templates, Tenants, Maintenance, Reports).
- Reports/Audit/Tenants en Community : la navigation affiche le verrou, mais les pages appellent encore une route absente (Lot 5).
- Le chiffre de disponibilité du dashboard s'affiche avec un espacement irrégulier (« 90 , 2 % ») : police monospace + espace fine insécable ; à corriger au Lot 2.
- Le navigateur Playwright Chromium n'est pas installé sur ce poste : E2E exécutés avec Edge (`channel: "msedge"`).
