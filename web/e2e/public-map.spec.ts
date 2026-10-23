import { test, expect, type Page } from "@playwright/test";
import { login, deleteArea } from "./helpers";

// Minimal valid 1×1 PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** API-created PROPERTY polygon (drawing itself is covered by map.spec). */
async function createProperty(
  page: Page,
  name: string,
  origin: [number, number],
  ownerName?: string
): Promise<string> {
  const [lng, lat] = origin;
  const ring = [
    [lng, lat],
    [lng + 0.0004, lat],
    [lng + 0.0004, lat + 0.0004],
    [lng, lat + 0.0004],
    [lng, lat],
  ];
  const res = await page.request.post("/api/v1/map-areas", {
    data: {
      name,
      area_type: "PROPERTY",
      geojson: { type: "Polygon", coordinates: [ring] },
      ...(ownerName ? { owner_name: ownerName } : {}),
    },
  });
  expect(res.status(), `create ${name}`).toBe(201);
  const body = await res.json();
  return body.data.id as string;
}

test.describe("Public read-only map", () => {
  test("anonymous view: parity, details, photos, NO controls, deep link, whitelist", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const unownedName = `E2E Public Unowned ${stamp}`;
    const saleName = `E2E Public For Sale ${stamp}`;
    let unownedId = "";
    let saleId = "";

    await login(page);
    try {
      // --- Fixture data (authenticated setup) ---
      unownedId = await createProperty(page, unownedName, [3.2897, 6.4617]);
      saleId = await createProperty(page, saleName, [3.2907, 6.4627], "Sale Owner");
      const patch = await page.request.patch(`/api/v1/map-areas/${saleId}`, {
        data: { for_sale: true },
      });
      expect(patch.status()).toBeLessThan(300);
      const upload = await page.request.post(`/api/v1/map-areas/${saleId}/photos`, {
        multipart: {
          file: { name: "public-building.png", mimeType: "image/png", buffer: TINY_PNG },
        },
      });
      expect(upload.status()).toBe(201);

      // --- Anonymous phase: drop the session entirely ---
      await page.context().clearCookies();
      await page.goto("/public/map");

      await expect(page.getByRole("heading", { name: "FHA Property Map" })).toBeVisible();
      await expect(
        page.getByText("Prototype Environment — Synthetic data, not official FHA records")
      ).toBeVisible();
      await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });

      // Data parity: the list's "N areas" must equal the public API count.
      const audit = await page.evaluate(async (ids) => {
        const list = await (await fetch("/api/v1/public/map-areas")).json();
        if (!Array.isArray(list?.data)) {
          throw new Error(`public areas payload: ${JSON.stringify(list).slice(0, 200)}`);
        }
        const areaS = list.data.find((a: { id: string }) => a.id === ids.sale);
        const photos = await (
          await fetch(`/api/v1/public/map-areas/${ids.sale}/photos`)
        ).json();
        const areaKeys = Object.keys(list.data[0] ?? {});
        const photoKeys = Object.keys(photos.data?.[0] ?? {});
        const forbidden = [
          "drawn_by",
          "uploaded_by",
          "description",
          "color",
          "plot_ids",
          "parent_area_id",
          "metadata",
          "storage_key",
          "latitude",
          "longitude",
        ];
        return {
          areaCount: list.data.length as number,
          saleAvailability: areaS?.availability?.kind as string | undefined,
          saleOwner: areaS?.owner_name as string | undefined,
          photoCount: photos.data?.length as number,
          leaked: forbidden.filter((k) => areaKeys.includes(k) || photoKeys.includes(k)),
        };
      }, { sale: saleId });

      expect(audit.leaked, "public payload must not leak internal fields").toEqual([]);
      expect(audit.saleAvailability).toBe("FOR_SALE");
      expect(audit.saleOwner).toBe("Sale Owner");
      expect(audit.photoCount).toBe(1);
      await expect(
        page.getByText(new RegExp(`\\d+ of ${audit.areaCount} areas`))
      ).toBeVisible();

      // Unowned area → "Available to enquire" in the list + factual details.
      await page.getByPlaceholder("Property or plot name…").fill("E2E Public Unowned");
      const unownedRow = page
        .locator("aside")
        .filter({ hasText: "Search areas" })
        .getByRole("button", { name: new RegExp(unownedName) });
      await expect(unownedRow).toBeVisible();
      await expect(unownedRow.getByText("Available to enquire")).toBeVisible();
      await unownedRow.click();
      await expect(
        page.getByRole("heading", { level: 2, name: unownedName })
      ).toBeVisible();
      await expect(page.getByText("No owner recorded — contact FHA to enquire")).toBeVisible();

      // For-sale area → listing chip, owner, photo strip.
      await page.getByPlaceholder("Property or plot name…").fill("E2E Public For Sale");
      const saleRow = page
        .locator("aside")
        .filter({ hasText: "Search areas" })
        .getByRole("button", { name: new RegExp(saleName) });
      await expect(saleRow).toBeVisible();
      await expect(saleRow.getByText("For sale", { exact: true })).toBeVisible();
      await saleRow.click();
      await expect(page.getByRole("heading", { level: 2, name: saleName })).toBeVisible();
      await expect(page.getByText("Listed for sale by owner")).toBeVisible();
      await expect(page.getByText("Building photos (1)")).toBeVisible();

      // Photo viewer opens — but never shows who uploaded it.
      await page.getByRole("button", { name: "View photo public-building.png" }).click();
      const dialog = page.getByRole("dialog", { name: "Evidence photo viewer" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("1 / 1")).toBeVisible();
      await expect(dialog.getByText("Uploaded by")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // No write controls exist anywhere on the public page.
      await expect(page.getByText("Take Photo")).toHaveCount(0);
      await expect(page.getByText("Upload Photos")).toHaveCount(0);
      await expect(page.getByText("List for sale")).toHaveCount(0);
      await expect(page.getByText("Copy public view link")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Save Area" })).toHaveCount(0);
      await expect(page.getByText("Audit Log")).toHaveCount(0);

      // Deep link: admin can share /public/map?area=<id> straight to the details.
      await page.goto(`/public/map?area=${saleId}`);
      await expect(page.getByRole("heading", { level: 2, name: saleName })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText("Listed for sale by owner")).toBeVisible();
    } finally {
      // Authenticated cleanup: photo (still unlocked — no outcome), then areas.
      await login(page);
      const listRes = await page.request.get(`/api/v1/map-areas/${saleId}/photos`);
      const listJson = await listRes.json().catch(() => null);
      for (const photo of listJson?.data ?? []) {
        await page.request.delete(`/api/v1/map-areas/${saleId}/photos/${photo.id}`);
      }
      for (const id of [saleId, unownedId].filter(Boolean)) {
        const status = await deleteArea(page.request, id);
        expect(status).toBeLessThan(300);
      }
    }
  });
});
