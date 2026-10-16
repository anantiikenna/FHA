import { test, expect } from "@playwright/test";
import {
  login,
  fetchAreas,
  deleteArea,
  openMap,
  drawBoxAndSave,
  waitForAreaByName,
} from "./helpers";

test.describe("Map: markings, drawing, naming", () => {
  test("map renders — worker loads, basemap tiles fetch, no MapLibre errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // The map must actually request basemap tiles. OSM occasionally
    // rate-limits bursts of automated runs (429) — that still proves the
    // tile pipeline works, so accept it alongside 200.
    const tileLoaded = page.waitForResponse(
      (r) =>
        r.url().includes("tile.openstreetmap.org") &&
        (r.status() === 200 || r.status() === 429),
      { timeout: 60_000 }
    );

    await login(page);
    await openMap(page);
    await tileLoaded;
    await page.waitForTimeout(2_000);

    const mapErrors = errors.filter((e) =>
      /worker failed to load|maplibre/i.test(e)
    );
    expect(mapErrors).toEqual([]);
  });

  test("drawn-area counts on the page match the API (markings parity)", async ({
    page,
  }) => {
    await login(page);
    const areas = await fetchAreas(page);

    await openMap(page);
    await expect(page.getByText(`${areas.length} areas`)).toBeVisible();

    await page.getByRole("button", { name: /Saved Areas \(\d+\)/ }).click();
    await expect(
      page.getByText(new RegExp(`^${areas.length} saved area`))
    ).toBeVisible();
  });

  test("area name labels render — glyph font requests fire", async ({
    page,
  }) => {
    await login(page);
    const glyphRequest = page.waitForRequest(
      /fonts\.openmaptiles\.org/,
      { timeout: 30_000 }
    );
    await openMap(page);
    await glyphRequest;
  });

  test("?area= deep link opens the named area panel", async ({ page }) => {
    await login(page);
    const areas = await fetchAreas(page);
    const target = areas[0];
    expect(target, "at least one map area must exist").toBeTruthy();

    await page.goto(`/map?area=${target!.id}`);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(target!.name).first()
    ).toBeVisible();
  });

  test("draw a box, name it, save it — reflects in list and API; cleans up", async ({
    page,
  }) => {
    await login(page);
    const before = await fetchAreas(page);
    const areaName = `E2E Drawn Area ${Date.now()}`;

    await openMap(page);
    await drawBoxAndSave(page, areaName, "Property");

    await expect(
      page.getByRole("button", { name: `Saved Areas (${before.length + 1})` })
    ).toBeVisible();

    const created = await waitForAreaByName(page, areaName);
    expect(created, "saved area must appear via the API").toBeTruthy();

    const status = await deleteArea(page.request, created!.id);
    expect(status).toBeLessThan(300);

    const after = await fetchAreas(page);
    expect(after.find((a) => a.id === created!.id)).toBeUndefined();

    // The page has no realtime delete subscription — reload to reflect it.
    await page.reload();
    await expect(
      page.getByRole("button", { name: `Saved Areas (${before.length})` })
    ).toBeVisible({ timeout: 30_000 });
  });
});
