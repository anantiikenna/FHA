import { test, expect } from "@playwright/test";
import { login, fetchAreas, propertyCount, DEMO_USER } from "./helpers";

test.describe("Smoke: auth, dashboard, data parity", () => {
  test("wrong password shows a user-friendly error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin").fill(DEMO_USER.username);
    await page.getByPlaceholder("••••••••").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText(/incorrect|invalid|failed|try again/i).first()
    ).toBeVisible();
  });

  test("login reaches the dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Open Map" })).toBeVisible();
  });

  test("dashboard stat cards match API counts (data parity)", async ({
    page,
  }) => {
    await login(page);
    const areas = await fetchAreas(page);

    const propertiesCard = page.locator(
      'a:has(p:text-is("Properties")):has(p.text-2xl)'
    );
    await expect(propertiesCard.locator("p.text-2xl")).toHaveText(
      String(propertyCount(areas))
    );

    const areasCard = page.locator(
      'a:has(p:text-is("Map Areas")):has(p.text-2xl)'
    );
    await expect(areasCard.locator("p.text-2xl")).toHaveText(
      String(areas.length)
    );
  });

  test("sidebar navigation reaches Properties", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Properties" }).first().click();
    await expect(page).toHaveURL(/\/plots$/);
    await expect(
      page.getByRole("heading", { name: "Properties", level: 1 })
    ).toBeVisible();
  });
});
