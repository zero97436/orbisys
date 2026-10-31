import { test, expect, type Page } from "@playwright/test";

/* Tests E2E du shell. Langue fixée à FR (sinon elle suit le navigateur) ;
 * les assertions portent sur la structure, pas sur les données de supervision. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("orbisys_lang", "fr"));
});

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@local");
  await page.locator('input[type="password"]').fill("admin1234");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Navigation principale" });

test("connexion et affichage du dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // État global annoncé en texte (pas seulement en couleur).
  await expect(page.getByRole("banner").getByText(/Plateforme/)).toBeVisible();
});

test("identifiants invalides -> message d'erreur", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@local");
  await page.locator('input[type="password"]').fill("mauvais");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Identifiants invalides")).toBeVisible();
});

test("navigation groupée et fil d'Ariane", async ({ page }) => {
  await login(page);
  for (const group of ["Vue générale", "Supervision", "Exploitation", "Administration"]) {
    await expect(mainNav(page).getByText(group, { exact: true })).toBeVisible();
  }
  for (const [link, crumb] of [
    ["Hôtes", "Supervision"],
    ["Checks", "Supervision"],
    ["Incidents", "Exploitation"],
    ["Paramètres", "Administration"],
  ] as const) {
    await mainNav(page).getByRole("link", { name: link, exact: true }).click();
    const bc = page.getByRole("navigation", { name: "Fil d'Ariane" });
    await expect(bc.getByText(crumb)).toBeVisible();
    await expect(bc.locator('[aria-current="page"]')).toHaveText(link);
    await expect(mainNav(page).getByRole("link", { name: link, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("palette Ctrl+K : ouverture, navigation clavier, fermeture par Échap", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.type("Incid");
  await expect(dialog.getByRole("option").first()).toContainText("Incidents");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/incidents$/);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("changement de langue FR -> EN", async ({ page }) => {
  await login(page);
  await page.getByRole("group", { name: "Langue" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByText("Overview", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tiroir de navigation, sans débordement horizontal", async ({ page }) => {
    await login(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation principale" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Incidents", exact: true }).click();
    await expect(page).toHaveURL(/\/incidents$/);
    await expect(drawer).toHaveCount(0);
  });
});

test("redirection vers login si non authentifié", async ({ page }) => {
  await page.goto("/hosts");
  await expect(page).toHaveURL(/\/login/);
});

test("remédiation : rien n'est exécuté sans confirmation explicite", async ({ page }) => {
  // Analyse et remédiation simulées : aucune requête n'atteint le backend.
  let remediateCalls = 0;
  await page.route("**/api/dashboard/incidents/*/analyze", (r) =>
    r.fulfill({ json: { analysis: "[TEST] analyse simulée", suggested_action: "restart_service", available_actions: [
      { id: "restart_service", label: "Redémarrer le service", description: "[TEST] action simulée" },
    ] } }),
  );
  await page.route("**/api/dashboard/incidents/*/remediate", (r) => {
    remediateCalls += 1;
    return r.fulfill({ json: { action: "restart_service", status: "success", detail: "[TEST] simulé" } });
  });
  await page.route("**/api/dashboard/incidents", (r) =>
    r.fulfill({ json: [{ alert_id: 999001, check_id: 1, check_name: "[TEST] HTTP", host_id: 1, host_name: "[TEST] web-01",
      status: "CRITICAL", message: "[TEST] incident simulé", since: new Date().toISOString(), acknowledged: false }] }),
  );
  await login(page);
  await page.goto("/incidents");
  await page.getByRole("button", { name: /Analyser|Analyze/ }).first().click();
  // L'analyse s'ouvre dans la fiche incident, présentée comme une hypothèse.
  const panel = page.getByRole("dialog", { name: /\[TEST\] web-01/ });
  await expect(panel).toContainText("hypothèse");
  await panel.getByRole("button", { name: /Redémarrer le service/ }).click();

  const dialog = page.getByRole("dialog", { name: /remédiation/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("[TEST] web-01");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toHaveCount(0);
  // Échap / Annuler sur la confirmation ne ferme pas la fiche (pile de dialogues).
  await expect(panel).toBeVisible();
  expect(remediateCalls).toBe(0);

  await panel.getByRole("button", { name: /Redémarrer le service/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /remédiation/ })).toHaveCount(0);
  await expect(panel).toBeVisible();
  expect(remediateCalls).toBe(0);

  await panel.getByRole("button", { name: /Redémarrer le service/ }).click();
  await page.getByRole("dialog", { name: /remédiation/ }).getByRole("button", { name: "Exécuter l'action" }).click();
  await expect.poll(() => remediateCalls).toBe(1);
});

/* ---------- Lot 2 : supervision ---------- */

test("dashboard : disponibilité calculée par le serveur, période modifiable", async ({ page }) => {
  const hoursRequested: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.endsWith("/dashboard/availability")) hoursRequested.push(u.searchParams.get("hours") ?? "");
  });
  await login(page);
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect.poll(() => hoursRequested.includes("24")).toBe(true);
  await page.getByRole("group", { name: "Période" }).first().getByRole("button", { name: "7 j" }).click();
  await expect.poll(() => hoursRequested.includes("168")).toBe(true);
});

test("hôtes : filtre d'état, tri, et suppression annulée sans requête", async ({ page }) => {
  let deletes = 0;
  await page.route("**/api/hosts/*", (r) => (r.request().method() === "DELETE" ? (deletes++, r.abort()) : r.continue()));
  await login(page);
  await page.goto("/hosts");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  await page.getByRole("group", { name: "Filtrer par état" }).getByRole("button", { name: /^Opérationnel/ }).click();
  const ok = await rows.count();
  expect(ok).toBeLessThanOrEqual(total);
  for (const badge of await rows.locator("td:first-child").allTextContents()) expect(badge).toContain("Opérationnel");
  await page.getByRole("group", { name: "Filtrer par état" }).getByRole("button", { name: /^Tous/ }).click();
  await page.getByRole("button", { name: /^Nom/ }).click();
  const names = await rows.locator("td:nth-child(2) a").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await rows.first().getByRole("button", { name: /^Supprimer/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(names[0]);
  await dialog.getByRole("button", { name: "Annuler" }).click();
  expect(deletes).toBe(0);
});

test("checks : le formulaire valide localement avant tout envoi", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/checks", (r) => (r.request().method() === "POST" ? (posts++, r.abort()) : r.continue()));
  await login(page);
  await page.goto("/checks");
  await page.getByRole("button", { name: "Nouveau check" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Configuration (JSON)").fill("{ pas du json");
  await dialog.getByRole("button", { name: "Créer le check" }).click();
  await expect(dialog.getByText("Choisissez l'hôte à superviser.")).toBeVisible();
  await expect(dialog.getByText("Donnez un nom au check.")).toBeVisible();
  await expect(dialog.getByText(/config_json invalide/)).toBeVisible();
  expect(posts).toBe(0);
});

test("checks : filtre par hôte depuis l'URL", async ({ page }) => {
  await login(page);
  await page.goto("/hosts");
  const firstHost = page.locator("tbody tr td:nth-child(2) a").first();
  const href = (await firstHost.getAttribute("href")) ?? "";
  const hostId = href.split("/").pop();
  await page.goto(`/checks?host=${hostId}`);
  await expect(page.locator("#chk-host")).toHaveValue(String(hostId));
});

test("fiche hôte : 404 distinguée d'une erreur réseau", async ({ page }) => {
  await login(page);
  await page.goto("/hosts/999999");
  await expect(page.getByText("Hôte introuvable")).toBeVisible();
  await expect(page.getByRole("link", { name: "Hôtes" }).last()).toBeVisible();
});

/* ---------- Lot 3 : exploitation ---------- */

test("incidents : fiche détaillée avec chronologie réelle, lien partageable", async ({ page }) => {
  await login(page);
  await page.goto("/incidents");
  await expect(page.getByText("Total actifs", { exact: false })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const details = page.getByRole("button", { name: /^Détails/ }).first();
  if (!(await details.count())) test.skip(true, "aucun incident actif dans l'environnement de test");
  await details.click();
  await expect(page).toHaveURL(/open=\d+/);
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Chronologie (journal du check)")).toBeVisible();
  await expect(panel.getByText("Analyse IA (hypothèse)")).toBeVisible();
  // Rechargement : la fiche se rouvre depuis l'URL.
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/open=/);
});

test("incidents : filtre « non acquittés » et tri", async ({ page }) => {
  const now = Date.now();
  const inc = (id: number, status: string, ack: boolean, minutes: number) => ({
    alert_id: id, check_id: id, check_name: `[TEST] c${id}`, host_id: 1, host_name: `[TEST] h${id}`, status,
    message: null, since: new Date(now - minutes * 60_000).toISOString(), acknowledged: ack,
  });
  await page.route("**/api/dashboard/incidents", (r) =>
    r.fulfill({ json: [inc(1, "WARNING", false, 5), inc(2, "CRITICAL", true, 60), inc(3, "CRITICAL", false, 10)] }),
  );
  await login(page);
  await page.goto("/incidents");
  const hosts = () => page.locator("main a[href^='/hosts/']").allTextContents();
  await expect.poll(hosts).toEqual(["[TEST] h3", "[TEST] h2", "[TEST] h1"]);
  await page.getByLabel("Non acquittés uniquement").check();
  await expect.poll(hosts).toEqual(["[TEST] h3", "[TEST] h1"]);
  await page.getByLabel("Trier").selectOption("newest");
  await expect.poll(hosts).toEqual(["[TEST] h1", "[TEST] h3"]);
});

test("maintenance : fin avant début refusée sans requête", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/maintenance**", (r) => (r.request().method() === "POST" ? (posts++, r.abort()) : r.continue()));
  await login(page);
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Planifier" }).click();
  await page.getByLabel("Début").fill("2030-01-02T10:00");
  await page.getByLabel("Fin").fill("2030-01-02T09:00");
  await page.getByRole("button", { name: "Planifier la maintenance" }).click();
  await expect(page.getByText("La fin doit être après le début.")).toBeVisible();
  expect(posts).toBe(0);
});

test("tickets : création, tâche, suppressions confirmées", async ({ page }) => {
  const title = `[TEST] e2e ${Date.now()}`;
  await login(page);
  await page.goto("/tickets");
  await page.getByRole("button", { name: "Nouveau ticket" }).click();
  await page.getByLabel("Titre").first().fill(title);
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  const card = page.locator(".card", { hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole("textbox", { name: "Ajouter une tâche" }).fill("[TEST] vérifier");
  await card.getByRole("button", { name: "Ajouter une tâche" }).click();
  await expect(card.getByText("[TEST] vérifier")).toBeVisible();
  // Suppression de tâche : annulée puis confirmée.
  await card.getByRole("button", { name: /Supprimer : \[TEST\] vérifier/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await expect(card.getByText("[TEST] vérifier")).toBeVisible();
  // Nettoyage : suppression du ticket avec confirmation.
  await card.getByRole("button", { name: /^Supprimer #/ }).click();
  await expect(page.getByRole("dialog")).toContainText(title);
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator(".card", { hasText: title })).toHaveCount(0);
});

/* ---------- Correctifs P0 (audit) ---------- */

test("P0-6 : aucun identifiant prérempli sur la connexion", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("#login-email")).toHaveValue("");
  await expect(page.locator("#login-password")).toHaveValue("");
});

test("P0-4 : module hors édition expliqué, sans appel à une route absente", async ({ page }) => {
  // Licence simulée Community : aucune fonctionnalité payante.
  await page.route("**/api/hosts/license", (r) =>
    r.fulfill({ json: { plan: "community", max_hosts: 25, features: [], used: 1, customer: null, expires: null } }));
  const calls: string[] = [];
  page.on("request", (r) => { if (/\/api\/(reports|audit|tenants)/.test(r.url())) calls.push(r.url()); });
  await login(page);
  for (const [path, edition] of [["/reports", "Professional"], ["/audit", "Enterprise"], ["/tenants", "Business"]] as const) {
    await page.goto(path);
    await expect(page.getByText("Module non inclus dans votre édition")).toBeVisible();
    await expect(page.getByText(new RegExp(`édition ${edition}`))).toBeVisible();
  }
  expect(calls).toEqual([]);
});

test("P0-5 : purge de rétention verrouillée jusqu'à la saisie du mot de confirmation", async ({ page }) => {
  let purges = 0;
  await page.route("**/api/admin/retention/run", (r) => { purges++; return r.abort(); });
  await login(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: /Purger maintenant/ }).click();
  const dialog = page.getByRole("dialog");
  const confirmBtn = dialog.getByRole("button", { name: /Purger maintenant/ });
  await expect(dialog).toContainText("irréversible");
  await expect(confirmBtn).toBeDisabled();
  await dialog.getByRole("textbox").fill("purger");
  await expect(confirmBtn).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  expect(purges).toBe(0);
});

test("P0-7 : mode TV — statut des tuiles et bandeau de perte de connexion", async ({ page }) => {
  await login(page);
  await page.goto("/tv");
  await expect(page.getByText(/· \d+ check/).first()).toBeVisible();
  await expect(page.getByText(/^(Opérationnel|Avertissement|Critique|Inconnu) · \d+ check/).first()).toBeVisible();
  await page.route("**/api/**", (r) => r.abort());
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("alert")).toContainText("Connexion perdue");
});

/* ---------- Lot 4 : visualisation ---------- */

test("topologie : seules les dépendances déclarées sont reliées, clic vers l'hôte", async ({ page }) => {
  await login(page);
  await page.goto("/topology");
  const nodes = page.locator(".react-flow__node-host");
  await expect(nodes.first()).toBeVisible();
  // Arêtes = uniquement des dépendances parent → enfant (aucun nœud « plateforme » fictif).
  const hosts = await page.request.get("/api/hosts", { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("sh_token") ?? "")}` } });
  const declared = (await hosts.json()).filter((h: { parent_host_id: number | null }) => h.parent_host_id).length;
  await expect(page.locator(".react-flow__edge")).toHaveCount(declared);
  await expect(page.getByText("Orbisys", { exact: true }).locator("xpath=ancestor::*[contains(@class,'react-flow__node')]")).toHaveCount(0);
  await nodes.first().click();
  await expect(page).toHaveURL(/\/hosts\/\d+$/);
});

test("carte des opérations : placement au clavier, annulation, aucun enregistrement implicite", async ({ page }) => {
  const token = async () => page.evaluate(() => localStorage.getItem("sh_token") ?? "");
  await login(page);
  const auth = { Authorization: `Bearer ${await token()}` };
  const created = await (await page.request.post("/api/bam", { headers: auth, data: { name: "[TEST] e2e service", category: "Général" } })).json();
  let layoutSaves = 0;
  await page.route("**/api/bam/layout", (r) => { layoutSaves++; return r.continue(); });
  try {
    await page.goto("/operations");
    await page.getByRole("button", { name: "Réorganiser" }).click();
    const tile = page.getByRole("button", { name: /\[TEST\] e2e service/ });
    const before = await tile.boundingBox();
    await tile.focus();
    await page.keyboard.press("Shift+ArrowRight");
    const after = await tile.boundingBox();
    expect(Math.round((after!.x - before!.x))).toBe(50);
    await page.getByRole("button", { name: "Annuler" }).click();
    expect(layoutSaves).toBe(0);
  } finally {
    await page.request.delete(`/api/bam/${created.id}`, { headers: auth });
  }
});

/* ---------- Lot 5 : IA et administration ---------- */

test("assistant IA : état du modèle, réponse marquée IA, plan confirmé avant toute exécution", async ({ page }) => {
  let applies = 0;
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { available: true, model: "test-model", model_installed: true } }));
  await page.route("**/api/ai/chat", (r) => r.fulfill({ json: {
    answer: "[TEST] réponse simulée", model: "test-model", sources: [],
    plan: { operations: [{ op: "delete_host", host_id: 999999, description: "[TEST] Supprimer l'hôte fictif", destructive: true }] },
  } }));
  await page.route("**/api/ai/apply-plan", (r) => { applies++; return r.fulfill({ json: { applied: 0, total: 1, results: [{ op: "delete_host", status: "skipped", detail: "[TEST]" }] } }); });
  await login(page);
  await page.goto("/assistant");
  await expect(page.getByRole("status").filter({ hasText: "test-model" })).toContainText("disponible");
  await page.getByLabel("Ex : quel hôte est en critique ?").fill("[TEST] question");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Généré par l'IA (test-model) — à vérifier")).toBeVisible();
  await expect(page.getByText("rien n'est exécuté sans votre confirmation")).toBeVisible();
  await page.getByRole("button", { name: /Examiner et appliquer/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("[TEST] Supprimer l'hôte fictif");
  await expect(dialog.getByRole("button", { name: "Appliquer le plan" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  expect(applies).toBe(0);
});

test("assistant IA : Ollama indisponible signalé clairement", async ({ page }) => {
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { available: false, model: "test-model", model_installed: false } }));
  await login(page);
  await page.goto("/assistant");
  await expect(page.getByRole("alert")).toContainText("ne répond pas");
});

test("licence : clé expirée expliquée, quota affiché", async ({ page }) => {
  await page.route("**/api/hosts/license", (r) => r.fulfill({ json: {
    plan: "community", max_hosts: 25, features: [], used: 3, customer: null, expires: null, key_status: "expired",
  } }));
  await login(page);
  await page.goto("/settings");
  const card = page.locator("#license");
  await expect(card).toContainText("Licence expirée");
  await expect(card).toContainText("La supervision continue normalement");
  await expect(card).toContainText("3 / 25");
});

test("canaux de notification : validation, édition requise, ajout et suppression confirmée", async ({ page }) => {
  let posts = 0;
  page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/notification-channels")) posts++; });
  await page.route("**/api/hosts/license", (r) =>
    r.fulfill({ json: { plan: "community", max_hosts: 25, features: [], used: 1, customer: null, expires: null, key_status: "none" } }));
  await login(page);
  await page.goto("/settings");
  const card = page.locator("#channels");
  // E-mail invalide : refusé sans requête.
  await card.getByLabel("Type de canal").selectOption("email");
  await card.getByLabel("Nom", { exact: true }).fill("[TEST] canal");
  await card.getByLabel("Destinataire").fill("pas-un-email");
  await card.getByRole("button", { name: "Ajouter le canal" }).click();
  await expect(card.getByText("Adresse e-mail invalide.")).toBeVisible();
  expect(posts).toBe(0);
  // Canal hors édition : verrouillé.
  await card.getByLabel("Type de canal").selectOption("slack");
  await expect(card.locator("p", { hasText: "Ce canal nécessite l'édition Professional" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Ajouter le canal" })).toBeDisabled();
  // Webhook valide : créé puis supprimé avec confirmation.
  await card.getByLabel("Type de canal").selectOption("webhook");
  await card.getByLabel("URL du webhook").fill("https://exemple.invalid/hook");
  await card.getByRole("button", { name: "Ajouter le canal" }).click();
  const row = card.locator("li", { hasText: "[TEST] canal" });
  await expect(row).toBeVisible();
  expect(posts).toBe(1);
  await card.getByRole("button", { name: "Supprimer [TEST] canal" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(row).toHaveCount(0);
});

test("premiers pas : étapes calculées sur les données réelles, masquables", async ({ page }) => {
  await page.route("**/api/settings/notification-channels", (r) => (r.request().method() === "GET" ? r.fulfill({ json: [] }) : r.continue()));
  // Réinitialise le masquage une seule fois (pas à chaque rechargement).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("gs-reset")) { localStorage.removeItem("orbisys_onboarding_hidden"); sessionStorage.setItem("gs-reset", "1"); }
  });
  await login(page);
  const card = page.getByRole("region", { name: /premiers pas/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Être prévenu");
  await expect(card.getByRole("link", { name: "Ajouter un canal" })).toBeVisible();
  await card.getByRole("button", { name: "Masquer les premiers pas" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  // Attendre que le tableau de bord ait chargé ses données (dont les canaux) avant de conclure.
  await page.waitForResponse((r) => r.url().includes("/api/settings/notification-channels"));
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: /premiers pas/ })).toHaveCount(0);
});
