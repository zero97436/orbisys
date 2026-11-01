# Orbisys

**🇫🇷 Français** · [🇬🇧 English](README.en.md)

<!-- Remplacer OWNER/REPO par le chemin GitHub réel une fois le dépôt poussé. -->
[![CI](https://github.com/zero97436/orbisys/actions/workflows/ci.yml/badge.svg)](https://github.com/zero97436/orbisys/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![Docker](https://img.shields.io/badge/docker-compose-2496ed)

**Plateforme de supervision d'infrastructure complète et auto-hébergée** — l'alternative
moderne aux outils de supervision traditionnels : hôtes, checks, alerting intelligent, tickets intégrés,
cartographie, APM, conteneurs, rapports SLA et assistant IA, le tout déployé en une
commande avec Docker Compose.

> 🖥️ Serveurs Linux/Windows · 🌐 Réseau (SNMP/SSH) · 📦 Docker/Kubernetes · 🖴 Proxmox/VMware ·
> 🔧 Matériel (IPMI/Redfish) · 🗄️ Bases de données · 📈 Applications (APM) · 🎫 Ticketing ·
> 🗺️ Cartes · 📄 Rapports PDF · 🤖 IA

---

## Table des matières

1. [Éditions](#-éditions-open-core--community--professional--business--enterprise)
2. [Fonctionnalités](#-fonctionnalités)
3. [Architecture](#-architecture)
4. [Installation](#-installation)
   - [Linux (production, recommandé)](#linux-production-recommandé)
   - [Windows](#windows-évaluation--poste-de-travail)
   - [macOS](#macos)
   - [Mise à jour](#mise-à-jour)
5. [Premiers pas](#-premiers-pas)
6. [L'agent de métriques (Windows/Linux)](#-lagent-de-métriques-windowslinux)
7. [Les 26 types de checks](#-les-26-types-de-checks)
8. [Alerting intelligent](#-alerting-intelligent)
9. [Tickets (ITSM intégré)](#-tickets-itsm-intégré)
10. [Les vues](#-les-vues)
11. [Migration depuis un autre outil](#-migration-depuis-un-autre-outil-de-supervision)
12. [Licence : activer la version payante](#-licence--activer-la-version-payante)
13. [Assistant IA (optionnel)](#-assistant-ia-optionnel)
14. [Sauvegarde & restauration](#-sauvegarde--restauration)
15. [Sécurité](#-sécurité)
16. [Dépannage (FAQ)](#-dépannage-faq)
17. [Développement & tests](#-développement--tests)

---

## 💰 Éditions (open-core) : Community · Professional · Business · Enterprise

Une édition **Community généreuse** pour l'adoption, des plans payants alignés sur
la maturité de l'organisation. Chaque plan **inclut tout ce qui précède**.

### 🆓 Community (gratuite, sans clé)
✅ **Jusqu'à 25 hôtes** · les 26 types de checks · dashboard complet · cartographie
(topologie + carte géographique) · historique · graphes de disponibilité · alertes
**e-mail + webhook** · maintenance, dépendances, flapping, escalades · agent
Windows/Linux · découverte réseau · templates · migration (.cfg / CSV) · tickets
internes · API REST · **assistant IA local** (analyse d'incident + chat — l'élément
différenciant reste gratuit) · mode TV · page de statut publique.

### 💼 Professional — *ajoute :*
✅ Canaux de notification avancés (**Slack, Teams, Discord, Telegram, SMS, script**)
· rapports **SLA / MTTR** · **export PDF** · **dashboards personnalisables** par
utilisateur · rétention étendue · personnalisation de marque · support par e-mail.

### 🏢 Business — *ajoute :*
✅ Connecteurs **ITSM** (Jira, ServiceNow, webhook sortant) · **automatisation de
remédiation** (actions agent + plans IA) · **supervision distribuée** (checks
exécutés par les sondes/agents) · **multi-tenant MSP** (clients cloisonnés) · API étendue.

### 🏛️ Enterprise — *ajoute :*
✅ **Haute disponibilité** (scheduler multi-instance, élection de leader) · **SSO /
SAML / OIDC** (Keycloak, Azure AD, Google…) · journal d'**audit / conformité** ·
support **24/7**, formation, développement spécifique, accompagnement.

**Fonctionnement :**
- Sans clé : édition Community, pour toujours. Au-delà d'une limite de plan, l'action
  est refusée avec un message clair indiquant le plan requis — **rien ne s'arrête**,
  la supervision existante continue.
- La clé de licence porte le plan (validée hors-ligne, signature Ed25519) ; les
  fonctionnalités se débloquent instantanément, sans réinstallation.
- Pour activer : voir [Licence](#-licence--activer-la-version-payante).

---

## ✨ Fonctionnalités

### Supervision
- **26 types de checks** (détail [ici](#-les-26-types-de-checks)) : ping, ports, HTTP(S),
  certificats SSL, DNS, NTP, SNMP (tout OID + trafic d'interfaces), SSH + commandes
  distantes, e-mail (SMTP/IMAP/POP3), FTP, LDAP, 4 moteurs de bases de données,
  Docker, Kubernetes, Proxmox, VMware, IPMI/Redfish, APM applicatif, agent Windows…
- **Agent de métriques** (Windows/Linux) : CPU, RAM, multi-disques, réseau, processus,
  températures, services Windows — avec exécution de checks déportée (mode sonde) et
  remédiation à distance validée par un opérateur.
- **Découverte réseau** : scan d'une plage IP, détection des ports ouverts, import en
  un clic avec checks suggérés.
- **Templates de checks** : jeux de checks réutilisables (fournis + création par
  capture d'un hôte existant), application à un hôte en un clic, sans doublon.

### Alerting
- Détection de changement d'état → **alerte** → **notifications** sur 8 canaux :
  e-mail, Slack, Telegram, Teams, Discord, SMS, webhook, script personnalisé.
- **Escalades** (canaux réservés au 2ᵉ niveau après X minutes sans acquittement),
  **plages horaires** par canal, **acquittement** des incidents.
- Suppression intelligente du bruit : **fenêtres de maintenance**, **dépendances
  parent/enfant** (routeur en panne = pas d'alerte pour les équipements derrière),
  **détection de flapping** (état instable = alertes suspendues, événement tracé).

### Exploitation
- **Tickets intégrés** (module ITSM complet) : création **automatique sur incident** (sans
  doublon, auto-résolus au retour OK), tâches (checklist), suivis horodatés,
  assignation avec notification e-mail, priorités, push **Jira / ServiceNow / webhook**.
- **Rapports** : SLA par hôte, MTTR, disponibilité 24 h/7 j/30 j, **export PDF**.
- **BAM** (supervision métier) : services métier agrégés (règle pire-état ou % OK).
- **Vues** : dashboard personnalisable par utilisateur, carte d'opérations métier
  (drag & drop), topologie réseau, **carte géographique** (placement au clic),
  **mode TV** plein écran, **page de statut publique** (sans login), recherche
  globale **Ctrl+K**, journal d'événements, APM, conteneurs Docker.
- **Assistant IA** (optionnel) : analyse d'incident, suggestions de remédiation,
  résumé de santé, chat en langage naturel — 100 % local, aucune donnée ne sort.

### Administration
- Utilisateurs et **rôles** (admin / opérateur / lecteur), HTTPS, secrets chiffrés
  en base, anti-bruteforce, rétention/purge automatique des données, sauvegardes,
  migration (config .cfg / CSV), 180+ tests automatisés.

---

## 🧱 Architecture

| Couche | Techno |
|---|---|
| Backend API | Python 3.12, FastAPI, SQLAlchemy 2, Alembic (migrations auto) |
| Exécution des checks | Celery + Redis (worker) + scheduler |
| Base de données | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Façade | Nginx (HTTP 8080 / HTTPS 8443) |
| IA (optionnel) | Ollama (LLM local) |

7 conteneurs orchestrés par un seul `docker-compose.yml` :
`db`, `redis`, `backend`, `worker`, `scheduler`, `frontend`, `nginx`.

---

## 🚀 Installation

### Prérequis (tous OS)

- **Docker** + **Docker Compose v2** (inclus dans Docker Desktop / paquet `docker-compose-plugin`)
- **2 Go de RAM** minimum recommandés, ~2 Go de disque
- Ports libres : **8080** (HTTP) et **8443** (HTTPS)

> Le logiciel s'installe **exclusivement via Docker** — c'est ce qui garantit une
> installation identique sur tous les systèmes. Aucune installation de Python, Node
> ou PostgreSQL n'est nécessaire sur la machine hôte.

### Linux (production, recommandé)

Testé sur Debian/Ubuntu ; identique sur RHEL/Alma/Rocky (remplacer `apt` par `dnf`).

```bash
# 1. Installer Docker (si absent)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Récupérer le projet
git clone https://github.com/zero97436/orbisys.git orbisys
cd orbisys

# 3. Configurer l'environnement
cp .env.example .env
nano .env
```

**Variables à modifier absolument avant la production :**

| Variable | Rôle |
|---|---|
| `SECRET_KEY` | clé de signature JWT + chiffrement des secrets. Générer : `openssl rand -hex 32`. ⚠️ Ne plus jamais la changer ensuite (elle déchiffre les secrets stockés). |
| `POSTGRES_PASSWORD` | mot de passe de la base |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | compte administrateur initial |
| `CORS_ORIGINS` | URL(s) réelles du serveur, ex. `https://supervision.mondomaine.fr:8443` |
| `INGEST_API_KEY` | clé exigée des agents de métriques (générer une valeur aléatoire) |
| `SMTP_*` | serveur mail pour les notifications e-mail |

```bash
# 4. Générer le certificat TLS auto-signé (une fois)
openssl req -x509 -nodes -newkey rsa:2048 -days 825   -keyout deploy/nginx/certs/server.key -out deploy/nginx/certs/server.crt   -subj "/CN=orbisys"

# 5. Démarrer (build + migrations automatiques)
docker compose up -d --build

# 6. Vérifier
docker compose ps                      # tous les services "Up"
curl -k https://localhost:8443/health  # {"status":"ok"}
```

→ Interface : `http://IP_DU_SERVEUR:8080` ou `https://IP_DU_SERVEUR:8443`
→ Connexion : la valeur de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (défaut `admin@local` / `admin1234` — **à changer !**)

**Finitions production conseillées :**

```bash
# Démarrage automatique au boot : déjà géré (restart policy Docker) si le démon
# Docker est activé :
sudo systemctl enable docker

# Sauvegarde quotidienne à 2h du matin (dump PostgreSQL dans ./backups) :
crontab -e
0 2 * * * cd /chemin/vers/Orbisys && ./scripts/backup.sh >> /var/log/orbisys-backup.log 2>&1

# Certificat TLS réel (par défaut : auto-signé) — déposer vos fichiers :
#   deploy/nginx/certs/server.crt  et  server.key
# puis : docker compose restart nginx
```

### Windows (évaluation / poste de travail)

1. Installer **Docker Desktop** (avec WSL2) : <https://www.docker.com/products/docker-desktop/>
2. Ouvrir PowerShell :

```powershell
git clone https://github.com/zero97436/orbisys.git orbisys
cd orbisys
Copy-Item .env.example .env
notepad .env          # mêmes variables que Linux
docker compose up -d --build
```

3. Interface sur `http://localhost:8080`.
4. Sauvegardes : `.\scripts\backup.ps1` (planifiable via le Planificateur de tâches —
   voir le commentaire en tête du script).

### macOS

Identique à Windows : **Docker Desktop pour Mac**, puis les mêmes commandes dans le
Terminal (`cp` au lieu de `Copy-Item`). Fonctionne sur Intel et Apple Silicon.

### NAS (Synology / QNAP / Unraid)

Fonctionne si le NAS propose Docker + Compose et dispose de **2 Go de RAM libres**.
Importer le `docker-compose.yml` dans l'interface Docker du NAS ou utiliser SSH avec
les commandes Linux ci-dessus.

### Mise à jour

```bash
cd orbisys
git pull
docker compose up -d --build     # migrations de base appliquées automatiquement
docker compose restart nginx     # rafraîchit la façade
```

Les données (base, sauvegardes) sont dans des volumes Docker : une mise à jour ne
touche jamais aux données. **Faire un backup avant** reste la bonne pratique.

### Désinstallation

```bash
docker compose down          # arrêt (données conservées)
docker compose down -v       # ⚠️ arrêt + SUPPRESSION des données
```

---

## 🎯 Premiers pas

1. **Se connecter** avec le compte admin, puis **changer le mot de passe**
   (Settings → Utilisateurs) et créer les comptes de l'équipe (rôles : admin /
   opérateur / lecteur).
2. **Ajouter un premier hôte** : page **Hosts** → « Nouvel hôte » (nom + IP), ou
   lancer une **Découverte** (scan d'une plage `192.168.1.0/24`) et importer les
   équipements détectés avec leurs checks suggérés.
3. **Appliquer un template** : page **Templates** → choisir « Serveur Linux »,
   « Serveur Web (HTTPS) », « Équipement réseau »… → sélectionner l'hôte → Appliquer.
   Les checks démarrent immédiatement.
4. **Configurer les notifications** : Settings → canaux de notification (e-mail,
   Telegram, Slack…) → bouton « Tester ».
5. **Placer les équipements sur la carte** : page **Carte** → « Ma position » puis
   « 📍 Placer un hôte » → clic sur la carte.
6. **Créer les services métier** (page **Métier**) pour alimenter la Vue Opérations
   et la page de statut publique (`/status`, accessible sans login).

---

## 📡 L'agent de métriques (Windows/Linux)

Pour les métriques système fines (CPU, RAM, **tous les disques**, réseau, processus,
températures) et les actions à distance, installer l'agent sur la machine :

```bash
# Prérequis : Python 3.10+ et psutil
pip install psutil requests

python scripts/agent_example.py \
  --server https://supervision.mondomaine.fr:8443 \
  --hostname MON-SERVEUR \
  --key VOTRE_INGEST_API_KEY \
  --interval 30
```

- **Windows** : planifier au démarrage via le Planificateur de tâches
  (`Register-ScheduledTask`, exemple en tête du script).
- **Linux** : unité systemd :

```ini
# /etc/systemd/system/orbisys-agent.service
[Unit]
Description=Agent Orbisys
After=network-online.target
[Service]
ExecStart=/usr/bin/python3 /opt/supervision/agent_example.py --server https://... --hostname %H --key XXX
Restart=always
[Install]
WantedBy=multi-user.target
```

L'agent permet aussi le **mode sonde** : exécuter des checks *depuis* cette machine
(ex. tester un équipement que le serveur central ne voit pas), et la **remédiation**
(redémarrer un service à distance après validation dans l'interface).

---

## 🔌 Les 26 types de checks

Chaque check a des seuils `warning`/`critical`, un intervalle, un timeout, et une
configuration JSON. Les mots de passe/secrets des configs sont **chiffrés en base**.

| Type | Supervise | Config principale |
|---|---|---|
| `ping` | vie d'un équipement (ICMP) | — |
| `tcp_port` | port ouvert | `{"port": 443}` |
| `http` | page web / API (code, latence, contenu) | `{"scheme": "https", "path": "/sante", "expect": "OK"}` |
| `ssl_expiry` | expiration du certificat | seuils = jours restants |
| `dns` | résolution DNS | `{"record": "A", "expect": "1.2.3.4"}` |
| `ntp` | dérive d'horloge d'un serveur de temps | seuils = ms de dérive |
| `snmp` | **n'importe quel OID** (CPU, uptime, toner, capteur…) | `{"oid": "1.3.6.1...", "community": "public"}` |
| `snmp_traffic` | débit + erreurs d'une interface réseau | `{"if_index": 1, "community": "public"}` |
| `ssh` | port + authentification SSH | `{"user": "...", "password": "..."}` |
| `ssh_command` | commande distante (= métrique sur mesure) | `{"command": "...", "expect": "..."}` |
| `smtp` / `imap` / `pop3` | serveurs de messagerie | `{"port": ..., "tls": true}` |
| `ftp` | serveur FTP | — |
| `ldap` | annuaire LDAP/AD | `{"base_dn": "dc=..."}` |
| `database` | **PostgreSQL, MySQL/MariaDB, Oracle, SQL Server** : connexion + requête + latence | `{"engine": "oracle", "user": "...", "password": "...", "dbname": "XEPDB1", "query": "SELECT 1 FROM dual"}` |
| `metric` | métriques de l'agent (cpu/mem/disk/net/load/température) | `{"metric": "cpu_percent"}` |
| `windows_service` | état d'un service Windows (via agent) | `{"service": "Spooler"}` |
| `disk_usage` / `cpu_load` | disque/CPU locaux du serveur de supervision | — |
| `apm` | applications : taux d'erreur, latence, débit | `{"app": "mon-erp", "metric": "error_rate"}` |
| `docker` | conteneurs : flotte entière ou conteneur précis (état, health, CPU) | `{}` ou `{"container": "nginx"}` |
| `kubernetes` | nodes / pods d'un namespace / deployment | `{"api_url": "https://...:6443", "token": "...", "mode": "pods", "namespace": "prod"}` |
| `proxmox` | cluster / VM+CT d'un node / une VM (CPU, RAM) | `{"api_url": "https://pve:8006", "token_id": "sup@pve!mon", "token_secret": "...", "mode": "cluster"}` |
| `vmware` | vCenter/ESXi : hôtes ESXi / VMs / une VM | `{"api_url": "https://vcenter", "user": "...", "password": "...", "mode": "hosts"}` |
| `ipmi` | santé **matérielle** via Redfish (iDRAC, iLO, XCC…) : ventilateurs, alims, RAID agrégés | `{"api_url": "https://idrac", "user": "...", "password": "..."}` |

**Exemples d'équipements couverts** : serveurs, switchs, routeurs, bornes Wi-Fi,
caméras IP (ping + port RTSP 554 + interface web), imprimantes (SNMP toners), NAS,
onduleurs (SNMP), hyperviseurs, conteneurs, sites web, applications métier.

---

## 🔔 Alerting intelligent

**Cycle** : changement d'état → alerte → notifications → escalade si non acquittée →
résolution automatique au retour OK.

| Mécanisme | Ce que ça fait | Réglage |
|---|---|---|
| **8 canaux** | e-mail, Slack, Telegram, Teams, Discord, SMS, webhook, script | Settings → Notifications |
| **Plages horaires** | un canal peut n'être actif que la nuit, le week-end… | `active_hours` du canal |
| **Escalade** | canaux « escalade seule » prévenus après X min sans acquittement | `ESCALATION_AFTER_MINUTES` (défaut 15) |
| **Maintenance** | fenêtre planifiée = aucune alerte pour l'hôte | page Incidents → Maintenances |
| **Dépendances** | hôte parent en panne = pas d'alerte pour ses enfants (injoignables ≠ en panne) | champ « Hôte parent » de la fiche hôte |
| **Flapping** | ≥ 7 changements d'état sur les 20 derniers résultats = alertes suspendues + événement tracé | `FLAPPING_*` dans `.env` |

Tout est journalisé dans la page **Événements** (alertes ouvertes/résolues,
suppressions et leur raison, notifications envoyées).

---

## 🎫 Tickets (ITSM intégré)

Un vrai module de ticketing (centre de services) :

- **Création automatique** sur incident (CRITICAL/WARNING) — activée par
  `ITSM_AUTO_CREATE=true` :
  - Titre : `NomDeLHôte : Incident sur NomDuCheck`
  - Corps rédigé (« Bonjour, … Cordialement, La supervision ») avec le détail technique
  - **Anti-doublon** : un seul ticket ouvert par check en panne, même en cas de flapping
  - **Auto-résolution** : le ticket passe « Résolu » quand le check revient OK
- **Édition complète** : titre, description, priorité, statut — chaque modification
  est journalisée dans les suivis (« titre : X → Y ; priorité : low → high »)
- **Tâches** : checklist avec progression (2/5), à cocher au fil de l'intervention
- **Suivis** : fil de commentaires horodatés avec auteur
- **Assignation** : à un utilisateur, avec **notification e-mail** automatique
  (sauf auto-assignation), filtre « À moi »
- **Push externe** : `ITSM_PROVIDER=jira|servicenow|webhook` → chaque ticket est aussi
  créé dans l'outil externe (lien cliquable conservé). Un échec de push ne bloque
  jamais le ticket local.

```ini
# .env — exemple Jira
ITSM_PROVIDER=jira
ITSM_URL=https://mycompany.atlassian.net
ITSM_USER=bot@mycompany.com
ITSM_TOKEN=xxxx
ITSM_PROJECT=OPS
ITSM_AUTO_CREATE=true
```

---

## 🖥️ Les vues

| Vue | URL | Description |
|---|---|---|
| **Dashboard** | `/dashboard` | état global, KPI, incidents, tendance — **personnalisable par utilisateur** (bouton « Personnaliser » : réordonner/masquer les sections) |
| **Monitoring** | `/monitoring` | flux d'événements temps réel + matrice de santé |
| **Hosts / Checks** | `/hosts`, `/checks` | gestion du parc, découverte réseau, import/migration |
| **Templates** | `/templates` | modèles de checks (fournis + capture d'hôte) |
| **Incidents** | `/incidents` | centre d'incidents : acquittement, analyse IA, remédiation, ticket en 1 clic, maintenances |
| **Tickets** | `/tickets` | module ITSM complet |
| **APM** | `/apm` | applications : débit/erreurs/latence (le backend s'auto-instrumente) |
| **Conteneurs** | `/containers` | Docker : état + CPU/RAM par conteneur |
| **Topology** | `/topology` | carte logique réseau (React Flow) avec dépendances |
| **Carte** | `/geo` | carte géographique mondiale — placement des hôtes **au clic** |
| **Opérations** | `/operations` | carte métier (business activity) — tuiles **drag & drop** |
| **Métier** | `/bam` | définition des services métier (BAM) |
| **Reports** | `/reports` | SLA, MTTR, disponibilité + **export PDF** |
| **Mode TV** | `/tv` | plein écran pour écran mural NOC (bouton « TV » en haut) |
| **Statut public** | `/status` | page de statut **sans authentification** pour vos utilisateurs (désactivable : `STATUS_PAGE_ENABLED=false`) |
| **Recherche** | `Ctrl+K` | recherche globale : hôtes, checks, tickets, événements, pages |

---

## 🔄 Migration depuis un autre outil de supervision

Page **Hosts → bouton « Importer »**. Deux formats, avec **prévisualisation
obligatoire** (rien n'est créé avant confirmation) et **imports idempotents**
(ré-importer ne crée jamais de doublon — dédoublonnage par IP).

### 1. CSV universel (depuis n'importe quel outil, via export CSV / Excel)

Exporter les hôtes de l'ancien outil en CSV avec ces colonnes (ordre libre,
séparateur `,` ou `;`, seules `name` et `ip` sont obligatoires) :

```csv
name;ip;environment;site;latitude;longitude;template;parent
Routeur Paris;192.168.1.1;production;Agence Paris;48.85;2.35;Équipement réseau (basique);
Serveur Paris;192.168.1.10;production;Agence Paris;;;Serveur Linux;Routeur Paris
```

| Colonne | Effet |
|---|---|
| `template` | applique automatiquement ce **modèle de checks** à l'hôte créé |
| `parent` | crée la **dépendance** parent/enfant (nom d'un hôte du fichier ou déjà existant) |
| `site`, `latitude`, `longitude` | l'hôte apparaît directement sur la **carte géographique** |

### 2. Fichiers de configuration (`.cfg`)

Coller (ou charger) le contenu de `hosts.cfg` + `services.cfg` concaténés :

- `define host` → hôte créé (alias, address) — la directive **`parents` devient une
  dépendance** Orbisys ✨
- `define service` → check mappé automatiquement :
  `check_http`→`http`, `check_tcp!8443`→`tcp_port 8443`, `check_ssh`, `check_ping`,
  `check_smtp/ftp/dns/imap/pop/ldap/snmp`…
- Un check `ping` est ajouté à chaque hôte
- Les commandes **non mappables** (plugins maison `check_custom_xyz`) sont listées en
  avertissements clairs — à recréer via `ssh_command` ou un type natif

### Conseils selon votre outil actuel

| Vous disposez de… | Chemin recommandé |
|---|---|
| **Fichiers de config `.cfg`** | import direct (format `.cfg`) |
| **Un export CSV / Excel** de l'inventaire | import CSV universel |
| **Une API / CLI d'export** | convertir l'export en CSV (nom, IP, site…) puis import CSV |
| **Aucun export possible** | utiliser la **Découverte réseau** intégrée : scan de la plage IP, import en un clic |

> 💡 L'historique de l'ancien outil n'est pas migré (les métriques repartent de zéro) —
> c'est la configuration qui compte, et elle se transfère en quelques minutes.

---

## 🔑 Licence : activer la version payante

1. Achetez une licence **Enterprise** auprès de l'éditeur (vous recevez une **clé
   signée** portant les fonctionnalités souscrites : SSO, HA, multi-tenant, support…).
2. Sur le serveur :

```ini
# .env
LICENSE_KEY=eyJwbGFuIjoicHJvIiwibWF4X2hvc3RzIjoxMDAwLC4uLg.a1b2c3...
```

```bash
docker compose up -d backend worker scheduler && docker compose restart nginx
```

3. Vérifier : page **Hosts** → « x hôtes · édition enterprise ».

- La clé est **signée cryptographiquement** (Ed25519) : toute clé modifiée, expirée ou
  invalide est ignorée et le logiciel revient à l'édition Community (sans jamais
  s'arrêter — la supervision continue).
- La clé peut porter une date d'expiration (licence annuelle) et un nom de client.
- Aucune connexion à Internet n'est requise pour la validation (hors-ligne total).

---

## 🤖 Assistant IA (optionnel)

L'IA est **entièrement locale** : aucune donnée de supervision ne quitte votre
infrastructure. Elle nécessite [Ollama](https://ollama.com) installé sur l'hôte :

```bash
ollama pull llama3.1:8b
```

```ini
# .env — défauts fonctionnels si Ollama tourne sur la machine hôte
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b
```

Ce que fait l'IA :
- **Analyser un incident** (bouton sur chaque alerte) : cause probable + actions suggérées
- **Remédiation assistée** : propose des actions (redémarrer un service…) exécutées
  par l'agent **après validation humaine** — jamais automatiquement
- **Résumé de santé** du parc sur le dashboard
- **Chat** (`/assistant`) : « quels hôtes ont eu des problèmes cette nuit ? »,
  avec possibilité de générer des plans d'action (création d'hôtes/checks) à valider

Sans Ollama : tout le reste du logiciel fonctionne normalement, les boutons IA
affichent simplement une erreur explicite.

---

## 💾 Sauvegarde & restauration

```bash
# Sauvegarde (dump PostgreSQL compressé dans ./backups/)
./scripts/backup.sh            # Linux/macOS
.\scripts\backup.ps1           # Windows

# Restauration
./scripts/restore.sh backups/supervision-2026-07-04.dump
.\scripts\restore.ps1 backups\supervision-2026-07-04.dump
```

À sauvegarder en plus du dump : le fichier **`.env`** (il contient `SECRET_KEY`, sans
laquelle les secrets chiffrés en base sont indéchiffrables) et `deploy/nginx/certs/`.

Rétention automatique des données (réglable dans `.env`) : résultats de checks 30 j,
métriques brutes 15 j (agrégats horaires 1 an), alertes résolues 90 j, événements 90 j.

---

## 🔁 Haute disponibilité (HA — Enterprise)

Le backend et les workers sont **stateless** : scalez-les librement derrière nginx.
Le seul composant à singleton est le **scheduler** — Orbisys intègre une **élection
de leader** (verrou Redis à TTL renouvelé) : lancez plusieurs schedulers, un seul
planifie, les autres veillent et prennent le relais **automatiquement** si le leader
tombe (aucune exécution de check dupliquée, bascule sans intervention).

```bash
# Plusieurs instances de chaque tier (Postgres/Redis en HA géré séparément) :
docker compose up -d --scale backend=3 --scale worker=3 --scale scheduler=2
```

- Bascule immédiate à l'arrêt propre (SIGTERM libère le verrou), sinon en ~90 s
  (expiration du bail) en cas de crash brutal.
- État du cluster : `GET /api/ha/status` (admin, Enterprise) — leader courant,
  fraîcheur du heartbeat.
- Sans Redis (mono-instance), le scheduler reste leader local : rien ne casse.
- Pour une HA complète, prévoir Postgres et Redis en haute disponibilité (réplication /
  service géré) — hors périmètre de l'image Orbisys.

---

## 🔐 Sécurité

- **HTTPS** prêt à l'emploi (certificat auto-signé fourni, remplaçable par le vôtre)
- **JWT** avec expiration 2 h, **anti-bruteforce** sur le login (10 essais / 5 min / IP,
  compté derrière le proxy via `X-Forwarded-For`)
- **RBAC** : admin (tout), opérateur (exploitation), lecteur (consultation)
- **Secrets chiffrés au repos** (Fernet) : mots de passe SNMP/SSH/BDD/API des configs
- La **page de statut publique** n'expose que le nom/état des services métier —
  jamais d'IP, d'hôte ni de détail technique
- Le canal de notification `script` exécute des commandes : **réservé aux admins**
- ⚠️ À faire à l'installation : changer `ADMIN_PASSWORD`, `SECRET_KEY`,
  `POSTGRES_PASSWORD`, définir `INGEST_API_KEY`, restreindre `CORS_ORIGINS`

---

## 🩺 Dépannage (FAQ)

**502 Bad Gateway après une mise à jour**
Nginx garde d'anciennes adresses de conteneurs :
```bash
docker compose restart nginx
```

**« Identifiants invalides » alors que le mot de passe est bon**
Vérifier que le conteneur backend est sain : `docker compose logs backend --tail 50`.

**Les e-mails ne partent pas**
`SMTP_HOST` est vide ou incorrect dans `.env`. Tester le canal depuis
Settings → Notifications → « Tester ». Avec Gmail : mot de passe d'application requis.

**L'agent n'apparaît pas / métriques absentes**
1. L'hôte existe-t-il avec le **même nom** que `--hostname` ?
2. `INGEST_API_KEY` de l'agent = celle du serveur ?
3. Logs de l'agent : erreur 401 (clé), 404 (hôte introuvable) ?

**La page Conteneurs dit « Docker Engine injoignable »**
Le socket n'est pas monté (hôte sans Docker ou compose modifié) — vérifier le volume
`/var/run/docker.sock` dans `docker-compose.yml`.

**Un check oscille et ne génère plus d'alertes**
C'est la détection de **flapping** (voulu). Voir la page Événements
(`alert_suppressed_flapping`). Régler `FLAPPING_THRESHOLD` si trop sensible.

**Réinitialiser le mot de passe admin oublié**
```bash
docker compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter_by(email='admin@local').first()
u.hashed_password = hash_password('NouveauMotDePasse!')
db.commit(); print('OK')"
```

---

## 🧪 Développement & tests

```bash
# Tests backend (180+ tests)
docker compose exec backend pytest -q

# Tests frontend
cd frontend && npx vitest run

# Rebuild après modification du code
docker compose up -d --build backend worker scheduler frontend
docker compose restart nginx
```

Ajouter un type de check = une classe dans `backend/app/checks/plugins/` + une ligne
dans `registry.py` + la valeur d'enum. Voir n'importe quel plugin existant comme modèle.

---

## Licence du code

Distribué selon les termes du fichier [LICENSE](LICENSE).
L'édition Community est gratuite et sans limite d'hôtes ; les fonctionnalités
Enterprise s'activent par clé de licence auprès de l'éditeur.
