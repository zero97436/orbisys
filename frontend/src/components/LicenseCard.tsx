import { AlertTriangle, BadgeCheck, CheckCircle2, KeyRound, Lock, XCircle } from "lucide-react";
import { Card, SectionTitle } from "./ui/Card";
import { FEATURE_PLAN, PLAN_LABEL, useLicense } from "../lib/license";
import { formatDate, formatNumber } from "../lib/format";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";

const DAY = 86400_000;
const PLAN_ORDER = ["professional", "business", "enterprise"] as const;

/** Licence : édition, état de la clé, expiration, quota, fonctionnalités. Lecture seule :
 *  l'activation se fait sur le serveur (LICENSE_KEY), le backend reste seul juge. */
export function LicenseCard() {
  const { t } = useI18n();
  const { license, loading } = useLicense();
  if (loading || !license) return null;

  const status = license.key_status ?? "none";
  const expires = license.expires ? new Date(license.expires).getTime() : null;
  const daysLeft = expires != null ? Math.ceil((expires - Date.now()) / DAY) : null;
  const expiringSoon = status === "valid" && daysLeft != null && daysLeft <= 30;
  const quotaPct = license.max_hosts ? Math.min(100, (license.used / license.max_hosts) * 100) : null;

  const tone = status === "valid" ? (expiringSoon ? "warning" : "ok") : status === "none" ? "info" : "critical";
  const Icon = tone === "ok" ? BadgeCheck : tone === "info" ? KeyRound : AlertTriangle;
  const toneCls = { ok: "border-status-ok/40 bg-status-ok/10 text-status-ok", warning: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    info: "border-border bg-bg-soft text-ink-soft", critical: "border-status-critical/40 bg-status-critical/10 text-status-critical" }[tone];

  return (
    <Card id="license">
      <SectionTitle title={t("lic.title")} icon={KeyRound} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div>
            <p className="eyebrow">{t("lic.edition")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{PLAN_LABEL[license.plan] ?? license.plan}</p>
            {license.customer && <p className="text-sm text-ink-soft">{license.customer}</p>}
          </div>
          <div role="status" className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", toneCls)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="text-ink">
              <span className="font-semibold">{t(`lic.st.${status}`)}</span>
              <span className="block text-xs text-ink-soft">
                {status === "valid"
                  ? (expires ? t("lic.expiresOn").replace("{date}", formatDate(license.expires!)).replace("{n}", String(daysLeft)) : t("lic.noExpiry"))
                  : t(`lic.stHint.${status}`)}
              </span>
            </span>
          </div>
          <div>
            <p className="eyebrow">{t("lic.hosts")}</p>
            <p className="mt-1 text-sm text-ink">
              {license.max_hosts == null
                ? t("lic.unlimited").replace("{n}", formatNumber(license.used))
                : `${formatNumber(license.used)} / ${formatNumber(license.max_hosts)}`}
            </p>
            {quotaPct != null && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft" aria-hidden>
                <div className={cn("h-full rounded-full", quotaPct >= 100 ? "bg-status-critical" : quotaPct >= 80 ? "bg-status-warning" : "bg-brand")} style={{ width: `${quotaPct}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="eyebrow mb-2">{t("lic.features")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLAN_ORDER.map((plan) => (
              <div key={plan} className="rounded-lg border border-border bg-bg-soft/40 p-3">
                <p className="mb-2 text-xs font-semibold text-ink-soft">{PLAN_LABEL[plan]}</p>
                <ul className="space-y-1">
                  {Object.entries(FEATURE_PLAN).filter(([, p]) => p === plan).map(([f]) => {
                    const on = license.features.includes(f);
                    return (
                      <li key={f} className={cn("flex items-center gap-1.5 text-xs", on ? "text-ink" : "text-ink-faint")}>
                        {on ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-ok" aria-hidden /> : <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        <span>{t(`lic.f.${f}`)}</span>
                        <span className="sr-only">{on ? t("lic.included") : t("lic.notIncluded")}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border p-3 text-xs text-ink-soft">
            <p className="font-medium text-ink">{status === "valid" ? t("lic.renewTitle") : t("lic.activateTitle")}</p>
            <p className="mt-1">{t("lic.activateHow")} <code className="kbd">LICENSE_KEY=…</code> {t("lic.activateHow2")}</p>
            <p className="mt-2 flex flex-wrap gap-3">
              <a href="https://orbisys.app/#pricing" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">{t("license.locked.cta")}</a>
              <a href="/docs#license" className="font-medium text-brand hover:underline">{t("license.locked.howto")}</a>
            </p>
          </div>
        </div>
      </div>
      {(status === "invalid" || status === "expired") && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint"><XCircle className="h-3.5 w-3.5" aria-hidden /> {t("lic.monitoringContinues")}</p>
      )}
    </Card>
  );
}
