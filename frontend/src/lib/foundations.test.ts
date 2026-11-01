import { describe, expect, it } from "vitest";
import { buildHostViews, overallStatus, prioritizeIncidents, availabilityInWindow, hostBuckets } from "./fleet";
import { formatDuration, formatPercent, timeAgo } from "./format";
import { NAV_GROUPS, NAV_ITEMS, navMatch } from "./nav";
import { apiError } from "./apiError";
import { translate } from "./i18n";
import type { Check, CheckResult, Host, Incident } from "../types";

const host = (id: number) => ({ id, name: `h${id}`, updated_at: "2026-10-01T00:00:00Z" }) as unknown as Host;
const check = (host_id: number, last_status: Check["last_status"]) => ({ id: Math.random(), host_id, last_status }) as unknown as Check;

describe("fleet", () => {
  it("un hôte sans check est UNKNOWN, pas OK", () => {
    const [v] = buildHostViews([host(1)], []);
    expect(v.status).toBe("UNKNOWN");
  });

  it("un hôte prend le statut de son check le plus grave", () => {
    const [v] = buildHostViews([host(1)], [check(1, "OK"), check(1, "WARNING"), check(1, "OK")]);
    expect(v.status).toBe("WARNING");
  });

  it("répartit les hôtes par état", () => {
    expect(hostBuckets([{ status: "OK" }, { status: "CRITICAL" }, { status: "OK" }])).toEqual({ OK: 2, WARNING: 0, CRITICAL: 1, UNKNOWN: 0 });
  });

  it("état global : le plus grave l'emporte, UNKNOWN sans données", () => {
    expect(overallStatus({ OK: 3, CRITICAL: 1 })).toBe("CRITICAL");
    expect(overallStatus({ OK: 3, WARNING: 2 })).toBe("WARNING");
    expect(overallStatus({ OK: 3 })).toBe("OK");
    expect(overallStatus({})).toBe("UNKNOWN");
  });

  it("priorise : gravité, puis non acquittés, puis le plus ancien", () => {
    const inc = (id: number, status: Incident["status"], acknowledged: boolean, since: string) =>
      ({ alert_id: id, status, acknowledged, since }) as unknown as Incident;
    const out = prioritizeIncidents([
      inc(1, "WARNING", false, "2026-10-01T10:00:00Z"),
      inc(2, "CRITICAL", true, "2026-10-01T09:00:00Z"),
      inc(3, "CRITICAL", false, "2026-10-01T11:00:00Z"),
      inc(4, "CRITICAL", false, "2026-10-01T08:00:00Z"),
    ]);
    expect(out.map((i) => i.alert_id)).toEqual([4, 3, 2, 1]);
  });

  it("disponibilité : null sans échantillon (pas de 100 % inventé)", () => {
    const now = Date.parse("2026-10-01T12:00:00Z");
    expect(availabilityInWindow([], 3600_000, now).ratio).toBeNull();
    const r = (status: string, at: string) => ({ status, checked_at: at }) as unknown as CheckResult;
    const res = availabilityInWindow(
      [r("OK", "2026-10-01T11:30:00Z"), r("CRITICAL", "2026-10-01T11:40:00Z"), r("OK", "2026-10-01T09:00:00Z")],
      3600_000, now,
    );
    expect(res.samples).toBe(2);
    expect(res.ratio).toBeCloseTo(50); // pourcentage 0–100
  });
});

describe("format (langue de l'application)", () => {
  it("timeAgo en FR et EN", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(iso, "fr")).toBe("il y a 5 min");
    expect(timeAgo(iso, "en")).toBe("5 min ago");
  });

  it("durées et pourcentages localisés", () => {
    expect(formatDuration(2 * 86400 + 4 * 3600, "fr")).toBe("2 j 4 h");
    expect(formatDuration(2 * 86400 + 4 * 3600, "en")).toBe("2 d 4 h");
    expect(formatPercent(99.5, 1, "en")).toBe("99.5%");
    expect(formatPercent(99.5, 1, "fr").replace(/\s/g, " ")).toBe("99,5 %");
  });
});

describe("navigation", () => {
  it("chaque entrée a une route unique et un libellé traduit FR/EN", () => {
    const routes = NAV_ITEMS.map((i) => i.to);
    expect(new Set(routes).size).toBe(routes.length);
    for (const key of [...NAV_ITEMS.map((i) => i.labelKey), ...NAV_GROUPS.map((g) => g.labelKey)]) {
      expect(translate("fr", key)).not.toBe(key);
      expect(translate("en", key)).not.toBe(key);
    }
  });

  it("résout les pages de détail vers leur module", () => {
    expect(navMatch("/hosts/12")?.item.to).toBe("/hosts");
    expect(navMatch("/hostsx")).toBeNull();
    expect(navMatch("/incidents")?.group.id).toBe("operate");
  });
});

describe("apiError", () => {
  it("détecte un refus de licence (403 + plan)", () => {
    const e = { response: { status: 403, data: { detail: "Fonctionnalité disponible à partir du plan Professional" } } };
    expect(apiError(e)).toMatchObject({ status: 403, isPlan: true, isNetwork: false });
  });

  it("distingue erreur réseau et refus de droits", () => {
    expect(apiError(new Error("Network Error")).isNetwork).toBe(true);
    expect(apiError({ response: { status: 403, data: { detail: "Droits insuffisants" } } }).isPlan).toBe(false);
  });
});
