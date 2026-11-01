import { useEffect, useState } from "react";
import { Palette, Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { getBrandingSettings, saveBranding, resetBranding } from "../api/endpoints";
import { Card, SectionTitle } from "./ui/Card";
import { useBranding } from "../lib/branding";
import { useI18n } from "../lib/i18n";
import { useConfirm } from "./ui/Confirm";
import { useToast } from "./ui/Toast";
import { apiErrorMessage } from "../lib/apiError";

export function BrandingPanel() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const { reload } = useBranding();
  const [form, setForm] = useState({ display_name: "", tagline: "", logo_url: "", accent_color: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBrandingSettings().then((r) => setForm({
      display_name: r.data.custom ? r.data.display_name : "",
      tagline: r.data.custom ? r.data.tagline : "",
      logo_url: r.data.logo_url ?? "",
      accent_color: r.data.accent_color ?? "",
    })).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveBranding({
        display_name: form.display_name || undefined,
        tagline: form.tagline || undefined,
        logo_url: form.logo_url || null,
        accent_color: form.accent_color || null,
      });
      reload();
      setMsg({ ok: true, text: t("brand.applied") });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg({ ok: false, text: detail ?? t("brand.saveFail") });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!(await confirm({ title: t("brand.resetTitle"), message: t("brand.resetBody"), confirmLabel: t("brand.resetBtn"), tone: "danger" }))) return;
    try {
      await resetBranding();
    } catch (e) {
      toast.error(apiErrorMessage(e, t("common.actionFailed")));
      return;
    }
    setForm({ display_name: "", tagline: "", logo_url: "", accent_color: "" });
    reload();
    setMsg({ ok: true, text: t("brand.restored") });
  };

  return (
    <Card>
      <SectionTitle title={t("brand.title")} icon={Palette} />
      <p className="mb-3 text-xs text-ink-faint">{t("brand.intro")}</p>
      <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input placeholder={t("brand.namePh")} value={form.display_name}
               onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="input" />
        <input placeholder={t("brand.taglinePh")} value={form.tagline}
               onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="input" />
        <input placeholder={t("brand.logoPh")} value={form.logo_url}
               onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className="input" />
        <div className="flex items-center gap-2">
          <input placeholder={t("brand.accentPh")} value={form.accent_color}
                 onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="input flex-1" />
          <input type="color" value={form.accent_color || "#3B82F6"}
                 onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                 className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-bg" title={t("brand.pickColor")} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={busy} className="btn-primary">
            <Save className="h-4 w-4" /> {t("brand.apply")}
          </button>
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4" /> {t("brand.restore")}
          </button>
        </div>
      </form>
      {msg && (
        <p className={`mt-2 flex items-center gap-1.5 text-xs ${msg.ok ? "text-status-ok" : "text-status-warning"}`}>
          {msg.ok && <CheckCircle2 className="h-3.5 w-3.5" />} {msg.ok ? "" : "⭐ "}{msg.text}
        </p>
      )}
    </Card>
  );
}
