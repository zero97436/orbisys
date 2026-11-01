from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operator
from app.core.config import settings
from app.core.crypto import encrypt_config, merge_secret_config, redact_config
from app.core.license import get_license
from app.core.tenancy import host_visible, is_scoped, scope_hosts
from app.db.session import get_db
from app.models.host import Host
from app.models.user import User
from app.repositories.host_repo import HostRepository
from app.schemas.host import HostCreate, HostOut, HostUpdate

router = APIRouter(prefix="/hosts", tags=["hosts"], dependencies=[Depends(get_current_user)])


def _out(host: Host) -> HostOut:
    """Sérialise un hôte pour l'API en masquant les secrets SSH."""
    out = HostOut.model_validate(host)
    out.ssh_config = redact_config(host.ssh_config)
    return out


def _seen(db: Session, user: User, host: Host | None) -> Host:
    """Renvoie l'hôte s'il est visible par l'utilisateur, sinon 404 (sans fuite)."""
    if not host or not host_visible(user, host):
        raise HTTPException(404, "Host not found")
    return host


def enforce_host_limit(db: Session, adding: int = 1) -> None:
    """Bloque la création au-delà du plafond d'hôtes SI la licence en fixe un.

    Édition Community : aucun plafond (max_hosts = None). Un plafond n'existe
    que si une clé de licence en définit un explicitement (accords OEM)."""
    lic = get_license()
    if lic["max_hosts"] is None:
        return
    current = db.query(Host).count()
    if current + adding > lic["max_hosts"]:
        raise HTTPException(
            403,
            f"Limite de la licence atteinte : {current}/{lic['max_hosts']} hôtes "
            f"(plan {lic['plan']}). Contactez l'éditeur pour étendre la licence.",
        )


@router.get("", response_model=list[HostOut])
def list_hosts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hosts = db.scalars(scope_hosts(select(Host).order_by(Host.name), user))
    return [_out(h) for h in hosts]


@router.get("/license")
def license_info(db: Session = Depends(get_db)):
    """Plan de licence + quota d'hôtes utilisé (affiché dans l'UI)."""
    from app.core.license import license_key_status

    lic = get_license()
    return {**lic, "used": db.query(Host).count(), "key_status": license_key_status()}


@router.post("", response_model=HostOut, status_code=201, dependencies=[Depends(require_operator)])
def create_host(payload: HostCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    enforce_host_limit(db)
    data = payload.model_dump()
    # Chiffre le mot de passe SSH au repos.
    if data.get("ssh_config"):
        data["ssh_config"] = encrypt_config(data["ssh_config"])
    # Un utilisateur cloisonné crée forcément dans SON tenant.
    if is_scoped(user):
        data["tenant_id"] = user.tenant_id
    return _out(HostRepository(db).create(**data))


@router.get("/{host_id}", response_model=HostOut)
def get_host(host_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(_seen(db, user, HostRepository(db).get(host_id)))


@router.put("/{host_id}", response_model=HostOut, dependencies=[Depends(require_operator)])
def update_host(host_id: int, payload: HostUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repo = HostRepository(db)
    host = _seen(db, user, repo.get(host_id))
    data = payload.model_dump(exclude_unset=True)
    # Fusionne/chiffre le secret SSH : un champ masqué conserve l'ancienne valeur.
    if "ssh_config" in data:
        data["ssh_config"] = merge_secret_config(data["ssh_config"], host.ssh_config) or None
    # Un utilisateur cloisonné ne peut pas réassigner l'hôte à un autre tenant.
    if is_scoped(user):
        data.pop("tenant_id", None)
    return _out(repo.update(host, **data))


@router.delete("/{host_id}", status_code=204, dependencies=[Depends(require_operator)])
def delete_host(host_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repo = HostRepository(db)
    host = _seen(db, user, repo.get(host_id))
    repo.delete(host)


@router.get("/{host_id}/enrollment", dependencies=[Depends(require_admin)])
def enrollment(host_id: int, request: Request, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """Instructions d'installation de l'agent (mode push/HTTPS) pour cet hôte.

    Réservé aux administrateurs : la réponse révèle la clé d'ingestion nécessaire
    pour configurer l'agent."""
    host = _seen(db, user, HostRepository(db).get(host_id))
    # Base API déduite de la requête (respecte le proxy/HTTPS via X-Forwarded-*).
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    hosthdr = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    api_base = f"{proto}://{hosthdr}{settings.API_PREFIX}"
    metrics_url = f"{api_base}/metrics/ingest"
    key = settings.INGEST_API_KEY or ""
    key_arg = f' --key "{key}"' if key else ""
    install_command = (
        f"python agent_example.py --url {metrics_url} "
        f"--host-id {host.id}{key_arg} --interval 30"
    )
    systemd_unit = (
        "[Unit]\n"
        "Description=Orbisys agent\n"
        "After=network-online.target\n\n"
        "[Service]\n"
        f"ExecStart=/usr/bin/python3 /opt/orbisys/agent_example.py --url {metrics_url} "
        f"--host-id {host.id}{key_arg} --interval 30\n"
        "Restart=always\n"
        "RestartSec=10\n\n"
        "[Install]\n"
        "WantedBy=multi-user.target\n"
    )
    return {
        "host_id": host.id,
        "hostname": host.hostname_or_ip,
        "monitoring_mode": host.monitoring_mode,
        "api_base": api_base,
        "metrics_url": metrics_url,
        "ingest_key_required": bool(key),
        "install_command": install_command,
        "systemd_unit": systemd_unit,
    }
