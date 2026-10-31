import { Lock } from "lucide-react";
import { FEATURE_PLAN, PLAN_LABEL, useLicense } from "../../lib/license";
import { useI18n } from "../../lib/i18n";
import { Loading } from "../States";

/** Module réservé à une édition supérieure : explique quoi, à partir de quelle édition,
 *  et comment l'obtenir. N'ouvre rien côté frontend : le backend reste seul juge. */
export function UpgradeNotice({ feature, titleKey }: { feature: string; titleKey?: string }) {
  const { t } = useI18n();
  const { license } = useLicense();
  const plan = PLAN_LABEL[FEATURE_PLAN[feature] ?? "professional"];
  const current = PLAN_LABEL[license?.plan ?? "community"] ?? license?.plan ?? "Community";
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-violet/15 text-accent-violet">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-ink">{titleKey ? t(titleKey) : t("license.locked.title")}</h2>
      <p className="max-w-lg text-sm text-ink-soft">
        {t("license.locked.body").replace("{plan}", plan).replace("{current}", current)}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <a href="https://orbisys.app/#pricing" target="_blank" rel="noopener noreferrer" className="btn-primary">
          {t("license.locked.cta")}
        </a>
        <a href="/docs#license" className="btn-ghost">{t("license.locked.howto")}</a>
      </div>
    </div>
  );
}

/** Petit cadenas + édition, pour un bouton ou une entrée de menu verrouillés. */
export function PlanTag({ feature }: { feature: string }) {
  const plan = PLAN_LABEL[FEATURE_PLAN[feature] ?? "professional"];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-violet/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-violet" title={plan}>
      <Lock className="h-2.5 w-2.5" aria-hidden />
      {plan}
    </span>
  );
}

/** Garde de route : si l'édition ne couvre pas `feature`, la page n'est pas montée
 *  (aucun appel à une route absente en Community) et l'édition requise est expliquée.
 *  Licence illisible (erreur réseau) : la page s'affiche, le backend décide. */
export function FeatureGate({ feature, titleKey, children }: { feature: string; titleKey: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const { has, loading } = useLicense();
  // Attendre la licence : sinon la page aurait le temps d'appeler une route absente.
  if (loading) return <Loading />;
  if (has(feature)) return <>{children}</>;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">{t(titleKey)}</h1>
      <UpgradeNotice feature={feature} />
    </div>
  );
}
