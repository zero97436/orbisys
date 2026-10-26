import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { CheckStatus } from "../types";
import { getLang, translate } from "./i18n";

export interface StatusMeta {
  /** Libellé dans la langue courante de l'application. */
  readonly label: string;
  /** Couleur hex (pour les charts / SVG). */
  color: string;
  /** Classes Tailwind texte. */
  text: string;
  /** Classes Tailwind fond doux + ring. */
  soft: string;
  /** Classes Tailwind point/indicateur. */
  dot: string;
  icon: LucideIcon;
}

export const STATUS: Record<CheckStatus, StatusMeta> = {
  OK: {
    get label() { return translate(getLang(), "status.OK"); },
    color: "#10B981",
    text: "text-status-ok",
    soft: "bg-status-ok/10 text-status-ok ring-1 ring-inset ring-status-ok/30",
    dot: "bg-status-ok",
    icon: CheckCircle2,
  },
  WARNING: {
    get label() { return translate(getLang(), "status.WARNING"); },
    color: "#F59E0B",
    text: "text-status-warning",
    soft: "bg-status-warning/10 text-status-warning ring-1 ring-inset ring-status-warning/30",
    dot: "bg-status-warning",
    icon: AlertTriangle,
  },
  CRITICAL: {
    get label() { return translate(getLang(), "status.CRITICAL"); },
    color: "#EF4444",
    text: "text-status-critical",
    soft: "bg-status-critical/10 text-status-critical ring-1 ring-inset ring-status-critical/30",
    dot: "bg-status-critical",
    icon: XCircle,
  },
  UNKNOWN: {
    get label() { return translate(getLang(), "status.UNKNOWN"); },
    color: "#64748B",
    text: "text-status-unknown",
    soft: "bg-status-unknown/10 text-status-unknown ring-1 ring-inset ring-status-unknown/30",
    dot: "bg-status-unknown",
    icon: HelpCircle,
  },
};

export const statusMeta = (s?: CheckStatus | null): StatusMeta =>
  STATUS[s ?? "UNKNOWN"];

/** Sévérité ordonnée pour le pire-état d'un groupe. */
const SEVERITY: CheckStatus[] = ["CRITICAL", "WARNING", "UNKNOWN", "OK"];

export function worstStatus(statuses: (CheckStatus | null | undefined)[]): CheckStatus {
  for (const s of SEVERITY) {
    if (statuses.includes(s)) return s;
  }
  return "OK";
}
