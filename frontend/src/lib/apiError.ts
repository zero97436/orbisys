/** Lecture uniforme des erreurs d'API (remplace les casts `(e as {response?…})` dispersés). */
export interface ApiErrorInfo {
  status: number | null;
  /** Message `detail` renvoyé par FastAPI, si c'est une chaîne. */
  detail: string | null;
  /** 403 « fonctionnalité disponible à partir du plan X » ou route absente de l'édition (404). */
  isPlan: boolean;
  isNetwork: boolean;
}

export function apiError(e: unknown): ApiErrorInfo {
  const resp = (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const status = resp?.status ?? null;
  const raw = resp?.data?.detail;
  const detail = typeof raw === "string" ? raw : null;
  const isPlan = status === 403 && !!detail && /plan|édition|edition/i.test(detail);
  return { status, detail, isPlan, isNetwork: !resp };
}

/** Message affichable : détail serveur s'il existe, sinon message générique traduit. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const info = apiError(e);
  return info.detail ?? fallback;
}
