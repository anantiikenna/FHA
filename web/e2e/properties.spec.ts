import { test, expect } from "@playwright/test";
import { login, fetchAreas, propertyCount } from "./helpers";

test.describe("Properties list", () => {
  test("property count matches the API (data parity)", async ({ page }) => {
    await login(page);
    const areas = await fetchAreas(page);

    await page.goto("/plots");
    await expect(
      page.getByText(`${propertyCount(areas)} properties`)
    ).toBeVisible();
  });

  test("every property row deep-links to its map panel", async ({ page }) => {
    await login(page);
    const properties = (await fetchAreas(page)).filter(
      (a) => a.area_type === "PROPERTY"
    );
    test.skip(properties.length === 0, "no properties in the database");

    await page.goto("/plots");
    const firstRow = page.locator("a[href*='/map?area=']").first();
    await expect(firstRow).toBeVisible();

    const href = await firstRow.getAttribute("href");
    const areaId = href?.split("area=")[1];
    const area = properties.find((a) => a.id === areaId);
    expect(area, "first row must correspond to a PROPERTY area").toBeTruthy();

    await firstRow.click();
    await expect(page).toHaveURL(new RegExp(`\\/map\\?area=${areaId}`));
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(area!.name).first()).toBeVisible();
  });
});
