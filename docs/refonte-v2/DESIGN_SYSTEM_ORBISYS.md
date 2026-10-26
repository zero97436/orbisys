# Design system Orbisys — application

Source de vérité : `frontend/src/index.css` (variables), `frontend/tailwind.config.js` (jetons Tailwind), `frontend/src/components/ui/*` (composants).

## 1. Principes

1. **Lisible avant d'être joli.** Densité maîtrisée, hiérarchie claire, pas d'effet décoratif gratuit.
2. **Jamais la couleur seule.** Un statut = couleur + icône + texte (visible ou `aria-label`).
3. **Données réelles uniquement.** Absence de données = état vide explicite, jamais une valeur par défaut flatteuse (pas de « 100 % » sans échantillon, pas d'hôte « OK » sans check).
4. **Toute action à impact se confirme.** Destructive ou exécutée sur l'infrastructure : `useConfirm`, ton `danger`.
5. **L'IA propose, l'humain décide.** Une suggestion IA est marquée « suggestion IA », jamais en bouton principal.
6. **La langue de l'application gouverne tout** : textes, dates, nombres (`localeOf(lang)`).

## 2. Couleurs (triplets RGB, thème sombre par défaut)

| Jeton | Sombre | Clair | Usage |
|---|---|---|---|
| `bg` | 8 12 30 | 245 247 252 | fond de page (bleu nuit) |
| `bg-soft` | 11 16 38 | 255 255 255 | barres, champs |
| `card` | 15 21 48 | 255 255 255 | cartes, modales |
| `border` / `border-soft` | 36 46 88 / 24 32 66 | 218 224 238 / 236 240 248 | séparateurs |
| `ink` / `ink-soft` / `ink-faint` | 236 240 252 / 172 182 216 / 132 143 182 | 11 18 48 / 62 72 112 / 92 101 136 | texte principal / secondaire / tertiaire |
| `brand` | 59 130 246 | idem | bleu électrique, action principale (surchargeable par le branding) |
| `accent-cyan` | 56 189 248 | idem | focus, liens techniques |
| `accent-violet` | 139 92 246 | idem | licences, IA |

### Statuts (variante par thème, contraste AA)

| Statut | Jeton | Icône | Source backend |
|---|---|---|---|
| OK | `status-ok` | CheckCircle2 | `CheckStatus.OK` |
| WARNING | `status-warning` | AlertTriangle | `CheckStatus.WARNING` |
| CRITICAL | `status-critical` | XCircle | `CheckStatus.CRITICAL` (inclut « down ») |
| UNKNOWN | `status-unknown` | HelpCircle | `CheckStatus.UNKNOWN`, hôte sans check |
| Info | `status-info` | Info | notifications |
| Maintenance | `status-maintenance` | Wrench | fenêtre de maintenance active (dérivée ; pas de statut backend) |

Définition unique : `lib/status.ts` (`statusMeta`, libellé traduit dynamiquement). Gravité : `SEVERITY_RANK` dans `lib/fleet.ts` (CRITICAL > WARNING > UNKNOWN > OK).

## 3. Typographie

- **Schibsted Grotesk** (texte, 400–900, variable), **JetBrains Mono** (valeurs techniques, identifiants, commandes). Hébergées localement (OFL, `public/fonts`), sans appel externe.
- Base 14 px / 1.5. Titres de page `text-2xl`/`semibold`, sur-titres `eyebrow` (11 px, majuscules), chiffres en `tabular-nums`.

## 4. Espacements et grille

Échelle Tailwind (4 px). Page : `p-4` mobile, `p-6` ≥ sm, largeur max 1680 px. Cartes : `p-4`/`p-5`, rayon `rounded-xl` ; modales `rounded-2xl`. Grilles responsives obligatoires (pas de `grid-cols-4` sans point de rupture).

## 5. Composants

| Composant | Fichier | Rôle |
|---|---|---|
| Boutons | `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.icon-btn` | Hauteur min. 36 px (30 px en `sm`). Un seul bouton primaire par zone. Bouton-icône = `aria-label` obligatoire. |
| Champs | `.input`, `.label`, `.field-hint`, `.field-error` | Toujours un `label` relié (`htmlFor`) ; erreur via `aria-invalid="true"`. |
| Tableau | `.table-std` | En-têtes en majuscules discrètes ; conteneur `overflow-x-auto`. |
| Puces | `.chip`, `.kbd`, `.eyebrow` | Filtres, raccourcis, sur-titres. |
| `Modal` | `ui/Modal.tsx` | `role="dialog"`, `aria-modal`, piège de focus, Échap, retour du focus ; variantes `center` et `drawer` (panneau latéral). |
| `ConfirmProvider` / `useConfirm` | `ui/Confirm.tsx` | Remplace `window.confirm`. Ton `danger`/`primary`, `details` (cible exacte), `requireText` pour l'irréversible à fort impact. |
| `ToastProvider` / `useToast` | `ui/Toast.tsx` | Remplace `alert()`. `role="status"`, ou `alert` pour les erreurs (qui restent jusqu'à fermeture). |
| `Loading`, `ErrorState`, `EmptyState`, `SkeletonGrid` | `States.tsx` | `ErrorState` avec `onRetry` ; `EmptyState` avec `title`, `icon` et `action` (action concrète suivante). |
| `UpgradeNotice`, `PlanTag` | `ui/UpgradeNotice.tsx` | Module hors édition : quoi, à partir de quelle édition, comment l'obtenir. N'ouvre rien côté client. |
| `StatusBadge`, `StatusDot` | `ui/StatusBadge.tsx` | Badge = icône + texte. Pastille = `label` obligatoire si aucun texte adjacent. |
| `PageHeader`, `Card`, `MetricCard` | `ui/*` | En-tête de page (avec `helpTopic`), cartes, indicateurs. |
| `CommandPalette` | `CommandPalette.tsx` | Ctrl+K : combobox/listbox ARIA, modules + recherche serveur. |

## 6. Shell et navigation

- Modèle unique `lib/nav.ts` (`NAV_GROUPS`) : barre latérale, tiroir mobile, fil d'Ariane, palette. Une entrée = une route existante.
- Groupes : Vue générale, Supervision, Exploitation, Analyse, Intelligence artificielle, Administration.
- `feature` : module sous licence → cadenas + édition requise (le module reste visible, la page explique).
- Barre latérale repliable (≥ lg), tiroir accessible (< lg), lien d'évitement « Aller au contenu ».
- Topbar : état global (icône + texte), signal **Hors ligne** si le serveur ne répond plus (données conservées mais marquées), compteur d'incidents non acquittés, recherche, langue, thème, horloge localisée.

## 7. États et données partagées

- `LiveStatusProvider` (`lib/liveStatus.tsx`) : résumé + incidents, une seule requête toutes les 20 s, en pause onglet masqué. À consommer par les pages au lieu de re-interroger.
- `LicenseProvider` (`lib/license.tsx`) : édition, fonctionnalités, `has(feature)` (affichage uniquement).
- `apiError(e)` / `apiErrorMessage(e, fallback)` : lecture uniforme des erreurs d'API (statut, `detail`, refus de licence, erreur réseau).

## 8. Mouvement

Animations courtes (≤ 200 ms), entrée de page `page-enter`. `prefers-reduced-motion` neutralise toutes les animations. Pas d'animation permanente hors indicateurs d'état actif (et désactivée en mouvement réduit).
