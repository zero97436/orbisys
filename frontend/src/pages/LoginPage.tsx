import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, LogIn, KeyRound } from "lucide-react";
import { api, tokenStore } from "../api/client";
import { forgotPassword } from "../api/endpoints";
import { BrandLogo } from "../components/ui/BrandLogo";
import { useBranding } from "../lib/branding";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function LoginPage() {
  const { branding } = useBranding();
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  // Jamais d'identifiants préremplis : le compte initial est documenté dans le README.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const onForgot = async () => {
    setError(null);
    if (!email) { setError(t("login.enterEmailFirst")); return; }
    try {
      const { data } = await forgotPassword(email);
      setForgotMsg(data.message);
    } catch {
      setForgotMsg(t("login.resetSent"));
    }
  };

  // SSO : bouton si activé côté serveur + réception du token au retour du fournisseur.
  useEffect(() => {
    api.get<{ enabled: boolean }>("/auth/sso/info").then((r) => setSsoEnabled(r.data.enabled)).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    const ssoError = params.get("sso_error");
    if (ssoToken) {
      tokenStore.set(ssoToken);
      window.location.replace("/dashboard");
    } else if (ssoError) {
      setError(`SSO : ${ssoError}`);
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      setError(t("login.invalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-status-ok/10 blur-[120px]" />

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onSubmit={onSubmit}
        className="card relative w-full max-w-sm p-8"
      >
        <div className="absolute right-4 top-4 flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
          {(["fr", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`grid h-6 w-7 place-items-center rounded text-[11px] font-semibold uppercase ${lang === l ? "bg-brand-soft text-white" : "text-ink-faint hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mb-6 flex items-center gap-3 pr-16">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
            <BrandLogo className="h-9 w-9" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">{branding.display_name}</h1>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">{branding.tagline}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{t("login.subtitle")}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 p-2.5 text-sm text-status-critical">
            {error}
          </div>
        )}

        <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-ink-soft">{t("login.email")}</label>
        <input id="login-email" type="email" required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="input mb-4 w-full" />

        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-ink-soft">{t("login.password")}</label>
        <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mb-1 w-full" />

        <div className="mb-5 text-right">
          <button type="button" onClick={onForgot} className="text-xs text-brand hover:underline">
            {t("login.forgot")}
          </button>
        </div>

        {forgotMsg && (
          <div role="status" className="mb-4 rounded-lg border border-status-ok/30 bg-status-ok/10 p-2.5 text-sm text-status-ok">
            {forgotMsg}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {loading ? t("login.submitting") : t("login.submit")}
        </button>

        {ssoEnabled && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-ink-faint">
              <span className="h-px flex-1 bg-border" /> {t("login.or")} <span className="h-px flex-1 bg-border" />
            </div>
            <a href="/api/auth/sso/login" className="btn-ghost w-full justify-center py-2.5">
              <KeyRound className="h-4 w-4" /> {t("login.sso")}
            </a>
          </>
        )}
      </motion.form>
    </div>
  );
}
