import { test, expect } from "@playwright/test";
import { loginAs, DEMO_USERS } from "./helpers";

test.describe("jemaah: donation → payment → receipt", () => {
  test("full flow: donate, pay, download receipt", async ({ page }) => {
    const user = DEMO_USERS.jemaah;
    await loginAs(page, user.email, user.home);

    await page.goto("/jemaah/derma");
    await expect(page.getByRole("heading", { name: /Derma & infaq/ })).toBeVisible();

    // Fill donation form
    await page.fill('input[name="amount"]', "100");
    await page.fill('input[name="donorName"]', "Ahmad Faiz bin Yusof");
    await page.fill('input[name="donorEmail"]', "jemaah@demo.my");
    await page.click('button:has-text("Teruskan ke pembayaran")');

    // Should land on checkout page
    await expect(page).toHaveURL(/\/jemaah\/bayar\/DONATION\//);
    await expect(page.getByRole("heading", { name: /Selesaikan bayaran/ })).toBeVisible();

    // Confirm payment
    await page.getByRole("button", { name: /Bayar/ }).click();

    // Should land on success page with receipt link
    await expect(page).toHaveURL(/\/jemaah\/bayar\/DONATION\/.*\/selesai/);
    await expect(page.getByRole("heading", { name: "Terima kasih" })).toBeVisible();

    const receiptLink = page.getByRole("link", { name: /Muat turun resit/ });
    await expect(receiptLink).toBeVisible();

    // Download receipt PDF
    const downloadPromise = page.waitForEvent("download");
    await receiptLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
