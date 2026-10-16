import { test, expect } from "@playwright/test";
import {
  login,
  fetchAreas,
  deleteArea,
  openMap,
  drawBoxAndSave,
  waitForAreaByName,
} from "./helpers";

// Minimal valid 1×1 PNG for the upload flow.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_NAME = "e2e-evidence.png";

test.describe("Evidence photos: upload, inspect, cross-view parity", () => {
  test("upload → lightbox with provenance metadata → same view from Properties → cleanup", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 6.4541, longitude: 3.3947 });

    await login(page);
    const areaName = `E2E Photo Area ${Date.now()}`;
    await openMap(page);
    await drawBoxAndSave(page, areaName, "Property");

    try {
      // saveArea auto-opens the panel for the new area.
      await expect(
        page.getByRole("heading", { level: 3, name: areaName })
      ).toBeVisible({ timeout: 15_000 });

      // Upload the evidence photo.
      await page.locator('input[type="file"]').first().setInputFiles({
        name: PNG_NAME,
        mimeType: "image/png",
        buffer: TINY_PNG,
      });
      await expect(page.getByText("1 photo").first()).toBeVisible({
        timeout: 20_000,
      });

      // Open the full-screen viewer from the thumbnail.
      await page.getByRole("button", { name: `View photo ${PNG_NAME} in full size` }).click();
      const dialog = page.getByRole("dialog", { name: "Evidence photo viewer" });
      await expect(dialog).toBeVisible();

      // Regression: the viewer must cover the viewport even when opened
      // from the map area panel — that panel's backdrop-blur used to
      // capture fixed positioning and squeeze the dialog into the panel.
      const vp = page.viewportSize();
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox, "viewer must have a bounding box").toBeTruthy();
      expect(dialogBox!.width).toBeGreaterThan(vp!.width * 0.9);
      expect(dialogBox!.height).toBeGreaterThan(vp!.height * 0.9);

      // Provenance metadata — what a reviewer needs to judge the evidence.
      await expect(dialog.getByText(PNG_NAME, { exact: true })).toBeVisible();
      await expect(dialog.getByText("Captured")).toBeVisible();
      await expect(dialog.getByText("Uploaded by")).toBeVisible();
      await expect(dialog.getByText(/6\.45/)).toBeVisible(); // GPS from granted location
      await expect(dialog.getByText("1 / 1")).toBeVisible();

      // Zoom controls present and keyboard hint shown.
      await expect(dialog.getByRole("button", { name: "Zoom in" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Zoom out" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Reset zoom to fit" })).toBeVisible();

      // Escape closes the viewer.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // Cross-view parity: the Properties list opens the SAME evidence for
      // every reviewer (fresh fetch from the shared API).
      await page.goto("/plots");
      await page.getByRole("button", { name: `View evidence photos for ${areaName}` }).click();
      const listDialog = page.getByRole("dialog", { name: "Evidence photo viewer" });
      await expect(listDialog).toBeVisible();
      const listBox = await listDialog.boundingBox();
      expect(listBox!.width).toBeGreaterThan(vp!.width * 0.9);
      expect(listBox!.height).toBeGreaterThan(vp!.height * 0.9);
      await expect(listDialog.getByText(PNG_NAME, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(listDialog).toBeHidden();

      // Cleanup assertions: the API deletes must succeed.
      const created = await waitForAreaByName(page, areaName);
      expect(created, "drawn area must exist via the API").toBeTruthy();
      const photosRes = await page.request.get(
        `/api/v1/map-areas/${created!.id}/photos`
      );
      const photosJson = await photosRes.json();
      expect(photosJson.success).toBe(true);
      for (const photo of photosJson.data) {
        const del = await page.request.delete(
          `/api/v1/map-areas/${created!.id}/photos/${photo.id}`
        );
        expect(del.status()).toBeLessThan(300);
      }
      const status = await deleteArea(page.request, created!.id);
      expect(status).toBeLessThan(300);
      const after = await fetchAreas(page);
      expect(after.find((a) => a.id === created!.id)).toBeUndefined();
    } finally {
      // Best-effort sweep so a mid-test failure never leaks demo records.
      try {
        const remaining = await fetchAreas(page);
        const leftover = remaining.find((a) => a.name === areaName);
        if (leftover) {
          const pr = await page.request.get(
            `/api/v1/map-areas/${leftover.id}/photos`
          );
          const pj = await pr.json().catch(() => null);
          for (const photo of pj?.data ?? []) {
            await page.request.delete(
              `/api/v1/map-areas/${leftover.id}/photos/${photo.id}`
            );
          }
          await deleteArea(page.request, leftover.id);
        }
      } catch {
        /* cleanup is best-effort */
      }
    }
  });
});
