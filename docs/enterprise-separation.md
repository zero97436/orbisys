# Architecture de séparation Enterprise (open-core)

But : que le **code payant ne soit PAS livré** dans l'édition Community (dépôt public
`github.com/zero97436/orbisys`). Ce qui n'est pas publié ne peut être ni lu ni déverrouillé.

Principe : **double protection**
1. **Absence de code** — les modules payants vivent dans un paquet Python séparé,
   hébergé dans un dépôt **privé** et absent de l'image Community.
2. **Garde de licence** (défense en profondeur) — même présent, chaque module
   revérifie la licence via `require_feature(...)` (utile pour vendre Business ≠ Enterprise).

Le noyau (public) ne connaît le paquet Enterprise que par un **point de chargement
dynamique** : s'il est là → chargé ; sinon → Community, rien ne casse.

---

## 1. Découpage des modules

### Tier A — séparables proprement (routers dédiés) → **paquet privé**
Ces modules ont leur propre fichier de route, on les **sort du dépôt public** :

| Module | Fichier actuel | Feature |
|---|---|---|
| SSO / SAML / OIDC | `app/api/routes/sso.py` | `sso` |
| Haute disponibilité | `app/api/routes/ha.py` | `ha` |
| Multi-tenant MSP | `app/api/routes/tenants.py` | `multi_tenant` |
| Audit / conformité | `app/api/routes/audit.py` + middleware d'audit dans `main.py` | `audit` |
| Rapports SLA/MTTR/PDF | `app/api/routes/reports.py` | `sla_reports`, `pdf_reports` |
| Remédiation (plans IA) | endpoints `apply-plan` / `remediate` | `remediation` |

### Tier B — gardes *inline* dans des fichiers partagés → **restent en flag runtime (phase 2)**
Branches `if has_feature(...)` à l'intérieur de fichiers Community. Extraction plus
coûteuse, valeur unitaire plus faible : on les traite plus tard via des *hooks*.

| Feature | Emplacement |
|---|---|
| `advanced_channels` | `routes/settings.py:37` |
| `custom_dashboards` | `routes/dashboard.py:68` |
| `distributed` | `routes/checks.py:43` |
| `extended_retention` | `services/retention_service.py:34` |
| `itsm_connectors` | `services/ticket_service.py:82` |
| `branding` | `routes/branding.py` (router dédié → déplaçable en Tier A si voulu) |

> `app/core/license.py` **reste dans le noyau public** : il ne contient que la clé
> **publique** (vérification). Aucun secret. Les fonctions `has_feature`/`require_feature`
> restent l'API de garde commune.

---

## 2. Arborescence cible

### Dépôt PUBLIC (`MVP/` — édition Community)
```
backend/app/
  main.py            # ne registre QUE les routers Community + appelle load_enterprise()
  plugins.py         # NOUVEAU : chargeur dynamique du paquet Enterprise
  core/
    license.py       # inchangé (clé publique, gardes)
    extensions.py    # NOUVEAU (phase 2) : registre de hooks pour le Tier B
  api/routes/        # sso.py, ha.py, tenants.py, audit.py, reports.py  ← RETIRÉS
```

### Dépôt PRIVÉ (`orbisys-enterprise/` — paquet installable)
```
orbisys_enterprise/
  __init__.py        # install(app, api_prefix) : point d'entrée unique
  routes/
    sso.py ha.py tenants.py audit.py reports.py remediation.py
  services/          # code métier premium (ex. générateur PDF, connecteurs)
  middleware/
    audit.py         # le middleware d'audit déplacé depuis main.py
  pyproject.toml     # paquet "orbisys-enterprise"
```

---

## 3. Contrat de plugin

### Noyau — `backend/app/plugins.py`
```python
"""Chargement optionnel de l'édition Enterprise (paquet séparé, dépôt privé)."""
import importlib
from app.core.logging import get_logger

logger = get_logger(__name__)
ENTERPRISE_PACKAGE = "orbisys_enterprise"


def load_enterprise(app, api_prefix: str) -> bool:
    """Charge les modules payants si le paquet est installé. Sinon → Community."""
    try:
        pkg = importlib.import_module(ENTERPRISE_PACKAGE)
    except ModuleNotFoundError:
        logger.info("Édition Community : paquet Enterprise absent.")
        return False
    pkg.install(app, api_prefix)            # le paquet enregistre ses routers/middleware
    logger.info("Édition Enterprise : modules chargés.")
    return True
```

### Noyau — `main.py` (modifications)
```python
# Retirer sso, audit, tenants, ha, reports (+ branding si Tier A) des imports.
from app.plugins import load_enterprise

for module in (auth, hosts, checks, dashboard, metrics, users, admin, ai, agent,
               maintenance, events, discovery, bam, tickets, apm, docker,
               check_templates, public_status, search, migrate, knowledge, roles,
               settings_routes):                       # ← liste Community only
    app.include_router(module.router, prefix=settings.API_PREFIX)

# Modules payants (présents uniquement dans l'image Enterprise) :
load_enterprise(app, settings.API_PREFIX)
```
> Le **middleware d'audit** (main.py:85-118) part dans le paquet Enterprise et est
> ré-attaché via `install()`. En Community il n'existe plus (au lieu d'un no-op gardé).

### Paquet privé — `orbisys_enterprise/__init__.py`
```python
def install(app, api_prefix: str) -> None:
    from .routes import sso, ha, tenants, audit, reports, remediation
    for m in (reports, sso, audit, tenants, ha, remediation):
        app.include_router(m.router, prefix=api_prefix)   # chaque router garde son require_feature(...)
    from .middleware.audit import add_audit_middleware
    add_audit_middleware(app)
```
Chaque router conserve `Depends(require_feature("..."))` → **défense en profondeur** :
un client Business qui reçoit le paquet n'obtient pas les endpoints Enterprise.

---

## 4. Deux cibles Docker

Une seule `Dockerfile`, un build-arg qui installe (ou non) le paquet privé :
```dockerfile
ARG EDITION=community
# ... build habituel ...
# Installe le paquet Enterprise uniquement pour l'image "enterprise",
# depuis un index/dépôt privé, via un secret de build (jamais dans une couche).
RUN --mount=type=secret,id=gh_token \
    if [ "$EDITION" = "enterprise" ]; then \
      pip install "orbisys-enterprise @ git+https://$(cat /run/secrets/gh_token)@github.com/zero97436/orbisys-enterprise.git" ; \
    fi
```
- **Image publique** (Docker Hub / GHCR public) : `--build-arg EDITION=community` → **aucun** code payant.
- **Image privée** (registre privé, livrée aux clients payants) : `EDITION=enterprise`.

Le `docker-compose.yml` public référence l'image Community. Les clients payants
reçoivent un compose pointant l'image privée + leur `LICENSE_KEY`.

---

## 5. Frontend (phasé)

Le SPA est un bundle unique aujourd'hui. Ordre de priorité :
- **Phase 1** : rien à faire de bloquant — les pages premium renvoient déjà 403.
  On masque juste les entrées de menu selon `getLicense().features` (cosmétique).
- **Phase 3** : sortir les pages premium en **chunks lazy-loadés** (`import()` dynamique)
  buildés uniquement dans l'image Enterprise ; le noyau public ne contient pas ces vues.
  La vraie logique de valeur étant côté backend, ce point est secondaire.

---

## 6. Tests

- Les tests des modules Tier A (`test_sso`, `test_audit`, `test_tenants`, `test_ha`,
  `test_reports`) **migrent dans le dépôt privé** (ils importent le code Enterprise).
- Le dépôt public garde les tests Community + un test du **chargeur** :
  `load_enterprise()` renvoie `False` proprement quand le paquet est absent.
- La CI publique tourne en Community ; une CI privée installe le paquet et lance
  l'ensemble.

---

## 7. Plan d'exécution (incrémental, sans casser l'existant)

1. **Phase 1a** — créer `app/plugins.py` + `load_enterprise()` ; garder les modules
   Tier A dans le noyau pour l'instant, mais enregistrés via un `install()` local
   (refactor neutre, tout reste vert).
2. **Phase 1b** — extraire le paquet `orbisys_enterprise/` (dépôt privé), y déplacer
   les 5-6 routers Tier A + middleware d'audit ; retirer du dépôt public.
3. **Phase 1c** — deux cibles Docker (`EDITION`), CI publique en Community.
4. **Phase 2** — `extensions.py` (hooks) pour les features Tier B qu'on veut vraiment
   retirer du paquet public (remédiation, connecteurs ITSM en priorité).
5. **Phase 3** — chunks front lazy pour les vues premium.

> Ordre recommandé : faire **Phase 1** d'abord (80 % de la valeur de protection pour
> 20 % de l'effort), mesurer, puis décider si Phase 2/3 valent le coût.
