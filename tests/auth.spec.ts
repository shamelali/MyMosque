import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("login & role redirect (email/password)", () => {
  for (const [key, user] of Object.entries(DEMO_USERS)) {
    test(`logs in as ${user.role} (${key}) and redirects to ${user.home}`, async ({ page }) => {
      await loginAs(page, user.email, user.home);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("rejects wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.click('summary:has-text("Masuk dengan e-mel & kata laluan")');
    await page.waitForSelector('details[open] input[name="email"]');
    await page.fill('details[open] input[name="email"]', "jemaah@demo.my");
    await page.fill('details[open] input[name="password"]', "salah1234");
    await page.click('details[open] button:has-text("Masuk")');
    await expect(page).toHaveURL(/ralat=kelayakan/);
  });

  test("rejects unknown email", async ({ page }) => {
    await page.goto("/login");
    await page.click('summary:has-text("Masuk dengan e-mel & kata laluan")');
    await page.waitForSelector('details[open] input[name="email"]');
    await page.fill('details[open] input[name="email"]', "tidakada@demo.my");
    await page.fill('details[open] input[name="password"]', "demo1234");
    await page.click('details[open] button:has-text("Masuk")');
    await expect(page).toHaveURL(/ralat=akaun/);
  });
});
