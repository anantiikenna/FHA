import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const DEMO_USER = { username: "admin", password: "passadmin" };

export interface ApiArea {
  id: string;
  name: string;
  area_type: string;
  status: string;
}

export async function login(page: Page, user = DEMO_USER): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("admin").fill(user.username);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

export async function fetchAreas(page: Page): Promise<ApiArea[]> {
  const body = await page.evaluate(async () => {
    const res = await fetch("/api/v1/map-areas");
    if (!res.ok) throw new Error(`GET /api/v1/map-areas -> ${res.status}`);
    return res.json();
  });
  if (!body?.success || !Array.isArray(body.data)) {
    throw new Error("Unexpected /api/v1/map-areas response shape");
  }
  return body.data as ApiArea[];
}

export function propertyCount(areas: ApiArea[]): number {
  return areas.filter((a) => a.area_type === "PROPERTY").length;
}

export async function deleteArea(
  request: APIRequestContext,
  id: string
): Promise<number> {
  const res = await request.delete(`/api/v1/map-areas/${id}`);
  return res.status();
}

export async function openMap(page: Page): Promise<void> {
  await page.goto("/map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
}

/** Draws a rectangle on the map and saves it as a named area. */
export async function drawBoxAndSave(
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

export async function waitForAreaByName(
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
