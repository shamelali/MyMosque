import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("jainj: mosque oversight, scores, alerts", () => {
  test("jainj officer can view masjid, skor, amaran, audit", async ({ page }) => {
    const user = DEMO_USERS.jainj;
    await loginAs(page, user.email, user.home);

    await page.goto("/jainj/masjid");
    await expect(page.getByRole("heading", { name: "Senarai Masjid" })).toBeVisible();

    await page.goto("/jainj/skor");
    await expect(page.getByRole("heading", { name: "Skor Masjid" })).toBeVisible();

    await page.goto("/jainj/amaran");
    await expect(page.getByRole("heading", { name: /Amaran|Peringatan/ })).toBeVisible();

    await page.goto("/jainj/audit");
    await expect(page.getByRole("heading", { name: /Audit/ })).toBeVisible();
  });

  test("auditor can view same jainj oversight pages", async ({ page }) => {
    const user = DEMO_USERS.auditor;
    await loginAs(page, user.email, user.home);

    await page.goto("/jainj/masjid");
    await expect(page.getByRole("heading", { name: "Senarai Masjid" })).toBeVisible();

    await page.goto("/jainj/skor");
    await expect(page.getByRole("heading", { name: "Skor Masjid" })).toBeVisible();

    await page.goto("/jainj/amaran");
    await expect(page.getByRole("heading", { name: /Amaran|Peringatan/ })).toBeVisible();
  });
});
