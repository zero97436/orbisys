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
  await page.getByRole("button", { name: /Redémarrer le service/ }).click();

  const dialog = page.getByRole("dialog", { name: /remédiation/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("[TEST] web-01");
  await expect(dialog).toContainText("hypothèse");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toHaveCount(0);
  expect(remediateCalls).toBe(0);

  await page.getByRole("button", { name: /Redémarrer le service/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Exécuter l'action" }).click();
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
