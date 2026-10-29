import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("tutor: schedule, bookings, payments", () => {
  test("tutor can view jadual, tempahan, and bayaran", async ({ page }) => {
    const user = DEMO_USERS.tutor;
    await loginAs(page, user.email, user.home);

    // Jadual
    await page.goto("/tutor/jadual");
    await expect(page.getByRole("heading", { name: "Jadual slot" })).toBeVisible();

    // Tempahan
    await page.goto("/tutor/tempahan");
    await expect(page.getByRole("heading", { name: /Tempahan/ })).toBeVisible();

    // Bayaran
    await page.goto("/tutor/bayaran");
    await expect(page.getByRole("heading", { name: /Bayaran/ })).toBeVisible();

    // Profil
    await page.goto("/tutor/profil");
    await expect(page.getByRole("heading", { name: /Profil/ })).toBeVisible();
  });
});
