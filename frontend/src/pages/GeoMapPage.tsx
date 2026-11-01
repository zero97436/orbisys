import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Crosshair, MousePointerClick } from "lucide-react";
import { listHosts, listChecks, updateHost } from "../api/endpoints";
import type { Check, Host } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ErrorState, Loading } from "../components/States";
import { buildHostViews } from "../lib/fleet";
import { statusMeta } from "../lib/status";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { canEdit } from "../lib/permissions";
import { cn } from "../lib/cn";

const DEFAULT_CENTER: [number, number] = [46.6, 2.4];

/** Zoom automatique pour englober tous les marqueurs. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    }
    // On ne re-cadre qu'au chargement / changement du nombre de points,
    // pas à chaque refresh (pour ne pas casser la navigation de l'utilisateur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

/** Capture le clic sur la carte en mode placement. */
function ClickCatcher({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Fond de carte. Par défaut : tuiles OpenStreetMap (sans clé ; usage modéré, cf.
 *  https://operations.osmfoundation.org/policies/tiles/). Pour un fournisseur avec clé
 *  ou un serveur de tuiles interne : VITE_MAP_TILE_URL et VITE_MAP_ATTRIBUTION au build.
 *  Le thème sombre est obtenu par filtre CSS (.orbisys-tiles, index.css). */
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Valeur de build (fixée par l'exploitant) : on n'accepte qu'une URL http(s) bien formée. */
function safeTileUrl(raw?: string): string {
  if (!raw) return DEFAULT_TILE_URL;
  try {
    const u = new URL(raw.replace(/\{[a-z]+\}/g, "0"));
    return u.protocol === "https:" || u.protocol === "http:" ? raw : DEFAULT_TILE_URL;
  } catch {
    return DEFAULT_TILE_URL;
  }
}
const TILE_URL = safeTileUrl(import.meta.env.VITE_MAP_TILE_URL);
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function GeoMapPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const editable = canEdit(user);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState<number>(0);   // id de l'hôte à placer (0 = aucun)
  const [flash, setFlash] = useState<string | null>(null);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);

  const load = () =>
    Promise.all([listHosts(), listChecks()])
      .then(([h, c]) => { setHosts(h.data); setChecks(c.data); })
      .catch(() => setError(t("common.loadError")));

  useEffect(() => {
    load().finally(() => setLoading(false));
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const views = useMemo(() => buildHostViews(hosts, checks), [hosts, checks]);
  const located = useMemo(() => views.filter((v) => v.latitude != null && v.longitude != null), [views]);
  const unlocated = views.filter((v) => v.latitude == null || v.longitude == null);
  const points = useMemo<[number, number][]>(
    () => located.map((l) => [l.latitude!, l.longitude!]),
    [located],
  );

  const place = async (lat: number, lon: number) => {
    if (!placing) return;
    const host = hosts.find((h) => h.id === placing);
    await updateHost(placing, { latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)) });
    setFlash(t("geo.placed").replace("{name}", host?.name ?? "").replace("{lat}", lat.toFixed(4)).replace("{lon}", lon.toFixed(4)));
    setPlacing(0);
    load();
    setTimeout(() => setFlash(null), 4000);
  };

  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setMyPos([pos.coords.latitude, pos.coords.longitude]),
      () => setFlash(t("geo.denied")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <PageHeader
        titleKey="page.geo.title"
        subtitleKey="page.geo.sub"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={locateMe} className="btn-ghost" title={t("geo.centerMe")}>
              <Crosshair className="h-4 w-4" /> {t("geo.myPos")}
            </button>
            {editable && (
              <select
                value={placing}
                onChange={(e) => setPlacing(Number(e.target.value))}
                className={cn("input text-xs", placing !== 0 && "ring-2 ring-brand")}
                title={t("geo.pickHost")}
              >
                <option value={0}>{t("geo.placeHost")}</option>
                {[...unlocated, ...located].map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.latitude == null ? "⬜ " : "✅ "}{h.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {placing !== 0 && (
        <div className="card border-l-4 border-brand bg-brand/5 p-3 text-sm text-ink">
          <MousePointerClick className="mr-1.5 inline h-4 w-4 text-brand" />
          {t("geo.clickExact")} <b>{hosts.find((h) => h.id === placing)?.name}</b> {t("geo.zoomFirst")}{" "}
          <button onClick={() => setPlacing(0)} className="ml-2 text-xs text-ink-faint hover:text-ink">{t("geo.cancel")}</button>
        </div>
      )}
      {flash && <div className="card border-l-4 border-status-ok bg-status-ok/5 p-3 text-sm text-ink">{flash}</div>}

      <div className={cn("card overflow-hidden p-0", placing !== 0 && "ring-2 ring-brand")}
           style={{ height: "calc(100vh - 260px)", minHeight: 420, cursor: placing ? "crosshair" : undefined }}>
        <MapContainer center={DEFAULT_CENTER} zoom={5} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} className="orbisys-tiles" maxZoom={19} />
          <FitBounds points={myPos ? [myPos] : points} />
          {placing !== 0 && <ClickCatcher onClick={place} />}

          {/* Ma position */}
          {myPos && (
            <CircleMarker center={myPos} radius={8}
                          pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.9, weight: 3 }}>
              <Tooltip direction="top" offset={[0, -8]} permanent>{t("geo.youHere")}</Tooltip>
            </CircleMarker>
          )}

          {located.map((l) => {
            const meta = statusMeta(l.status);
            return (
              <CircleMarker
                key={l.id}
                center={[l.latitude!, l.longitude!]}
                radius={10}
                pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.75, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>{l.name}</Tooltip>
                <Popup>
                  <div className="min-w-[180px] space-y-1.5">
                    <p className="font-semibold">{l.name}</p>
                    {l.location && <p className="text-xs opacity-70">📍 {l.location}</p>}
                    <StatusBadge status={l.status} size="xs" />
                    <p className="text-xs opacity-70">{l.checksCount} {t("geo.checksCount")} · {l.hostname_or_ip}</p>
                    <Link to={`/hosts/${l.id}`} className="text-xs font-medium text-blue-400 hover:underline">
                      {t("geo.viewHost")}
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-faint">
        <MapPin className="h-3.5 w-3.5" />
        {located.length} {t("geo.placed")}
        {unlocated.length > 0 && <> · {unlocated.length} {t("geo.toPlace")}</>}
        · {t("geo.refresh30")}
      </p>
    </div>
  );
}
