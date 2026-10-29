import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("role guards", () => {
  test("jemaah is redirected away from /portal", async ({ page }) => {
    await loginAs(page, DEMO_USERS.jemaah.email, DEMO_USERS.jemaah.home);
    await page.goto("/portal");
    await expect(page).not.toHaveURL("/portal");
  });

  test("jemaah cannot access portal kewangan laporan", async ({ page }) => {
    await loginAs(page, DEMO_USERS.jemaah.email, DEMO_USERS.jemaah.home);
    await page.goto("/portal/kewangan/laporan");
    await expect(page).not.toHaveURL("/portal/kewangan/laporan");
  });

  test("ajk can access portal but not finance report generation", async ({ page }) => {
    await loginAs(page, DEMO_USERS.ajk.email, DEMO_USERS.ajk.home);
    await page.goto("/portal");
    await expect(page).toHaveURL("/portal");

    // AJK is not in MANAGER_ROLES for dokumen upload, and not in canManageFinance
    // The generate report form should not render for AJK
    await page.goto("/portal/kewangan/laporan");
    await expect(page.getByRole("heading", { name: /Laporan Bulanan/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Jana" })).not.toBeVisible();
  });

  test("auditor cannot access scoring API", async ({ page }) => {
    await loginAs(page, DEMO_USERS.auditor.email, DEMO_USERS.auditor.home);
    const response = await page.request.post("/api/v1/scoring/run");
    expect(response.status()).toBe(403);
  });

  test("jainj can access scoring API", async ({ page }) => {
    await loginAs(page, DEMO_USERS.jainj.email, DEMO_USERS.jainj.home);
    const response = await page.request.post("/api/v1/scoring/run");
    expect(response.status()).not.toBe(403);
  });
});
