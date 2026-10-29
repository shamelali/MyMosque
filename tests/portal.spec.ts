import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("portal: finance & monthly report (BENDAHARI)", () => {
  test("bendahari can view kewangan and generate laporan bulanan", async ({ page }) => {
    const user = DEMO_USERS.bendahari;
    await loginAs(page, user.email, user.home);

    // Kewangan
    await page.goto("/portal/kewangan");
    await expect(page.getByRole("heading", { name: /Lejar & Resit/ })).toBeVisible();

    // Laporan bulanan
    await page.goto("/portal/kewangan/laporan");
    await expect(page.getByRole("heading", { name: /Laporan Bulanan/ })).toBeVisible();

    // Generate a report for current month
    await page.selectOption('select[name="month"]', String(new Date().getMonth() + 1));
    await page.selectOption('select[name="year"]', String(new Date().getFullYear()));
    await page.getByRole("button", { name: "Jana" }).click();

    // Report should appear in the senarai laporan table
    await expect(page.locator("table")).toBeVisible();
  });
});
