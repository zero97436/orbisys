import { defineConfig, devices } from "@playwright/test";

/**
 * Tests E2E contre l'application en cours d'exécution (façade Nginx sur :8080).
 * Lancer la stack avant : `docker compose up -d` à la racine du projet.
 * Surcharger l'URL si besoin : E2E_BASE_URL=http://localhost:5173 npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Parallélisme limité : au-delà, le serveur de dev (Vite) sature et des tests
  // échouent par délai dépassé sans régression réelle (constaté avec 8+ workers).
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
