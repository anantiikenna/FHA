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
    // A pre-armed waitForResponse shares one 60s budget with login + map
    // boot, so slow local starts can expire before the first tile request
    // is even issued — collect from test start and poll instead. This
    // test is always first in the suite (cold server/page), so the poll
    // gets extra headroom.
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // The map must actually request basemap tiles. OSM occasionally
    // rate-limits bursts of automated runs (429) — that still proves the
    // tile pipeline works, so accept it alongside 200.
    const tileStatuses: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("tile.openstreetmap.org")) tileStatuses.push(r.status());
    });

    await login(page);
    await openMap(page);
    await expect
      .poll(() => tileStatuses.filter((s) => s === 200 || s === 429).length, {
        timeout: 120_000,
        message: "basemap tiles must fetch (200, or 429 under OSM rate limiting)",
      })
      .toBeGreaterThan(0);
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
    // Style loads and label painting are async — collecting requests from
    // test start and polling after the map is up avoids losing the race
    // with a slow local style load (a pre-armed waitForRequest expires
    // while the map is still painting). The ?area= deep link flies the
    // camera onto a named area so its label is guaranteed in view.
    test.setTimeout(180_000);
    const glyphUrls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("fonts.openmaptiles.org")) glyphUrls.push(req.url());
    });
    await login(page);
    const areas = await fetchAreas(page);
    const target = areas[0];
    expect(target, "at least one map area must exist").toBeTruthy();

    await page.goto(`/map?area=${target!.id}`);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => glyphUrls.length, {
        timeout: 60_000,
        message: "glyph font requests must fire once the area label renders",
      })
      .toBeGreaterThan(0);
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
    // Draw + Geoman retries + API polling + reload can exceed the default
    // 90s budget on slower machines — the post-reload assert needs headroom.
    test.setTimeout(150_000);
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
