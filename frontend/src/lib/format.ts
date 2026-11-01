import { getLang, type Lang } from "./i18n";

/** Locale Intl de la langue de l'application (pas celle du navigateur). */
export const localeOf = (lang: Lang = getLang()): string => (lang === "en" ? "en-GB" : "fr-FR");

export function formatDate(iso: string, lang?: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "medium" });
}

export function formatTime(iso: string, lang?: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** « il y a 3 min » / « 3 min ago » — relatif, compact, dans la langue de l'application. */
export function timeAgo(iso: string, lang: Lang = getLang()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const s = Math.floor(Math.max(0, Date.now() - then) / 1000);
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  const v = s < 60 ? `${s} s` : m < 60 ? `${m} min` : h < 24 ? `${h} h` : `${d} ${lang === "en" ? "d" : "j"}`;
  return lang === "en" ? `${v} ago` : `il y a ${v}`;
}

/** Durée compacte depuis un nombre de secondes : « 2 j 4 h », « 3 h 12 min », « 45 s ». */
export function formatDuration(totalSeconds: number, lang: Lang = getLang()): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  const day = lang === "en" ? "d" : "j";
  if (d > 0) return `${d} ${day} ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${sec} s`;
}

/** Durée écoulée depuis une date (uptime, durée d'un incident). */
export function uptimeSince(iso: string, lang?: Lang): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return "—";
  return formatDuration((Date.now() - start) / 1000, lang);
}

export function formatNumber(n: number, digits = 0, lang?: Lang): string {
  return n.toLocaleString(localeOf(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Pourcentage localisé : « 99,5 % » en français, « 99.5% » en anglais. */
export function formatPercent(n: number, digits = 2, lang: Lang = getLang()): string {
  const v = formatNumber(n, digits, lang);
  return lang === "en" ? `${v}%` : `${v} %`;
}

export function formatMs(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export const CHECK_TYPES = [
  "ping",
  "tcp_port",
  "http",
  "disk_usage",
  "cpu_load",
  "ssl_expiry",
  "metric",
  "snmp",
  "dns",
  "ssh",
  "smtp",
  "ftp",
  "database",
  "ssh_command",
  "imap",
  "pop3",
  "ldap",
  "snmp_traffic",
  "windows_service",
  "apm",
  "docker",
  "kubernetes",
  "proxmox",
  "vmware",
  "ipmi",
  "ntp",
] as const;
