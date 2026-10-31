import { describe, expect, it } from "vitest";
import { diffIncidents } from "./liveStatus";
import type { Incident } from "../types";

const inc = (alert_id: number, status: Incident["status"]) =>
  ({ alert_id, status, host_name: `h${alert_id}`, check_name: "c", since: "2026-10-01T00:00:00Z", acknowledged: false }) as unknown as Incident;

describe("diffIncidents", () => {
  it("détecte apparition, changement de gravité et résolution", () => {
    const ev = diffIncidents([inc(1, "WARNING"), inc(2, "CRITICAL")], [inc(1, "CRITICAL"), inc(3, "WARNING")]);
    const byKind = Object.fromEntries(ev.map((e) => [e.kind, e]));
    expect(ev).toHaveLength(3);
    expect(byKind.new.hostName).toBe("h3");
    expect(byKind.changed).toMatchObject({ hostName: "h1", status: "CRITICAL" });
    expect(byKind.resolved).toMatchObject({ hostName: "h2", status: "OK" });
  });

  it("aucun événement si rien ne change", () => {
    expect(diffIncidents([inc(1, "WARNING")], [inc(1, "WARNING")])).toEqual([]);
  });

  it("identifiants uniques même au même instant", () => {
    const ev = diffIncidents([], [inc(1, "WARNING"), inc(2, "WARNING")], 1000);
    expect(new Set(ev.map((e) => e.id)).size).toBe(2);
  });
});
