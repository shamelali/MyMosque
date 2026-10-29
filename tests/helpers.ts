import { expect, type Page } from "@playwright/test";

const DEMO_PASSWORD = "demo1234";

export async function loginAs(page: Page, email: string, expectPath: string) {
  await page.goto("/login");
  // Expand the "Masuk dengan e-mel & kata laluan" details element
  await page.click('summary:has-text("Masuk dengan e-mel & kata laluan")');
  // Wait for the form to be visible and target the visible inputs
  await page.waitForSelector('details[open] input[name="email"]');
  await page.fill('details[open] input[name="email"]', email);
  await page.fill('details[open] input[name="password"]', DEMO_PASSWORD);
  // Click login and wait for navigation
  await page.click('details[open] button:has-text("Masuk")');
  await page.waitForURL(expectPath, { timeout: 15000 });
}

export const DEMO_USERS: Record<string, { email: string; role: string; home: string }> = {
  ketua: { email: "ketua@masjid.demo", role: "KETUA", home: "/portal" },
  setiausaha: { email: "setiausaha@masjid.demo", role: "SETIAUSAHA", home: "/portal" },
  bendahari: { email: "bendahari@masjid.demo", role: "BENDAHARI", home: "/portal" },
  ajk: { email: "ajk@masjid.demo", role: "AJK", home: "/portal" },
  jainj: { email: "pegawai@jainj.demo", role: "JAINJ", home: "/jainj" },
  auditor: { email: "auditor@jainj.demo", role: "AUDITOR", home: "/jainj" },
  tutor: { email: "tutor@masjid.demo", role: "TUTOR", home: "/tutor" },
  jemaah: { email: "jemaah@demo.my", role: "JEMAAH", home: "/jemaah" },
};
