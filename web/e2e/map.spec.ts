import { test, expect, type Page } from "@playwright/test";
import {
  login,
  fetchAreas,
  deleteArea,
  openMap,
  type ApiArea,
} from "./helpers";

async function drawBoxAndSave(
  page: Page,
  areaName: string,
  kind: "Zone" | "Property" | "Plot"
): Promise<void> {
  // First-visit map tour sits over the canvas — dismiss it so it cannot
  // intercept the drawing clicks below.
  const gotIt = page.getByRole("button", { name: "Got it" });
  await gotIt
    .waitFor({ state: "visible", timeout: 3_000 })
    .catch(() => undefined);
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
  }

  // Geoman finishes initializing at a variable time after the canvas
  // appears — clicking the tool while gm is still null is silently ignored,
  // so retry until the drawing bar (Done) shows the tool is engaged.
  const done = page.getByRole("button", { name: "Done" });
  let engaged = false;
  for (let i = 0; i < 10 && !engaged; i++) {
    await page.getByTitle("Draw Box").click();
    engaged = await done
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(engaged, "Draw Box tool must engage (Geoman ready)").toBe(true);

  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map canvas has no bounding box");

  // First corner must actually register as a vertex ("1 point" counter).
  let pointRegistered = false;
  for (let i = 0; i < 3 && !pointRegistered; i++) {
    await page.mouse.click(
      box.x + box.width * (0.45 + i * 0.04),
      box.y + box.height * (0.55 + i * 0.04)
    );
    pointRegistered = await page
      .getByText(/^1 point$/)
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(pointRegistered, "first draw point must register").toBe(true);

  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.7);

  // A rectangle auto-completes after its 2nd corner — the name modal opens
  // directly (the Done bar is for polygons only).
  await expect(
    page.getByRole("heading", { name: "Save This Area" })
  ).toBeVisible({ timeout: 10_000 });

  const kindHint = kind === "Zone" ? "Active container" : "Direct outcome";
  await page
    .getByRole("button", { name: new RegExp(`${kind}.*${kindHint}`, "i") })
    .click();
  await page
    .getByPlaceholder("e.g. Plot 12 — Unapproved structure")
    .fill(areaName);
  await page
    .getByPlaceholder(/Property owner/)
    .fill("E2E Test Owner");
  await page.getByRole("button", { name: "Save Area" }).click();

  await expect(page.getByRole("heading", { name: "Save This Area" })).toBeHidden();
}

async function waitForAreaByName(
  page: Page,
  name: string,
  timeoutMs = 20_000
): Promise<ApiArea | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const areas = await fetchAreas(page);
    const found = areas.find((a) => a.name === name);
    if (found) return found;
    await page.waitForTimeout(500);
  }
  return undefined;
}

test.describe("Map: markings, drawing, naming", () => {
  test("map renders — worker loads, basemap tiles fetch, no MapLibre errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const tileLoaded = page.waitForResponse(
      (r) => r.url().includes("tile.openstreetmap.org") && r.status() === 200,
      { timeout: 30_000 }
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
