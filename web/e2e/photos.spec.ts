import { test, expect } from "@playwright/test";
import {
  login,
  fetchAreas,
  deleteArea,
  openMap,
  drawBoxAndSave,
  waitForAreaByName,
  sweepE2EArea,
} from "./helpers";

// Minimal valid 1×1 PNG for the upload flows.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_1 = "e2e-evidence-1.png";
const PNG_2 = "e2e-evidence-2.png";
const PHOTO_LIMIT = 5;

test.describe("Evidence photos: upload, inspect, cross-view parity", () => {
  test("multi-upload → lightbox navigation → same view from Properties → cleanup", async ({
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

      // Select two photos in one batch — multi-select is the point.
      const fileInputs = page.locator('input[type="file"]');
      await fileInputs.nth(1).setInputFiles([
        { name: PNG_1, mimeType: "image/png", buffer: TINY_PNG },
        { name: PNG_2, mimeType: "image/png", buffer: TINY_PNG },
      ]);

      // Header shows the count against the per-area limit.
      await expect(page.getByText(`2 of ${PHOTO_LIMIT} photos`)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText("Added 2 photos.")).toBeVisible();
      await expect(
        page.getByRole("button", { name: `View photo ${PNG_1} in full size` })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: `View photo ${PNG_2} in full size` })
      ).toBeVisible();

      // Open the full-screen viewer from the newest thumbnail (prepend order).
      await page.getByRole("button", { name: `View photo ${PNG_2} in full size` }).click();
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
      await expect(dialog.getByText(PNG_2, { exact: true })).toBeVisible();
      await expect(dialog.getByText("Captured")).toBeVisible();
      await expect(dialog.getByText("Uploaded by")).toBeVisible();
      await expect(dialog.getByText(/6\.45/)).toBeVisible(); // GPS from granted location
      await expect(dialog.getByText("1 / 2")).toBeVisible();

      // Keyboard navigation between photos in the same evidence set.
      await page.keyboard.press("ArrowRight");
      await expect(dialog.getByText("2 / 2")).toBeVisible();
      await expect(dialog.getByText(PNG_1, { exact: true })).toBeVisible();

      // Zoom controls present.
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
      await expect(listDialog.getByText("1 / 2")).toBeVisible();
      await expect(listDialog.getByText(PNG_2, { exact: true })).toBeVisible();
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
      expect(photosJson.data).toHaveLength(2);
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
      await sweepE2EArea(page, areaName);
    }
  });

  test("per-area photo cap is enforced server-side", async ({ page }) => {
    test.setTimeout(240_000);
    await login(page);
    const areaName = `E2E Cap Area ${Date.now()}`;
    await openMap(page);
    await drawBoxAndSave(page, areaName, "Property");

    try {
      const area = await waitForAreaByName(page, areaName);
      expect(area, "drawn area must exist via the API").toBeTruthy();

      // Fill to the cap via the API — the UI multi-upload path is covered
      // by the test above; this locks the SERVER enforcement contract.
      for (let i = 0; i < PHOTO_LIMIT; i++) {
        const res = await page.request.post(
          `/api/v1/map-areas/${area!.id}/photos`,
          {
            multipart: {
              file: {
                name: `cap-${i}.png`,
                mimeType: "image/png",
                buffer: TINY_PNG,
              },
            },
          }
        );
        expect(res.status(), `upload ${i + 1} of ${PHOTO_LIMIT} must succeed`).toBe(201);
      }

      // GET reports the cap so any client can render "n of max".
      const listRes = await page.request.get(
        `/api/v1/map-areas/${area!.id}/photos`
      );
      const list = await listRes.json();
      expect(list.meta.max).toBe(PHOTO_LIMIT);
      expect(list.data).toHaveLength(PHOTO_LIMIT);

      // One more must be rejected with the documented error code.
      const over = await page.request.post(
        `/api/v1/map-areas/${area!.id}/photos`,
        {
          multipart: {
            file: { name: "cap-over.png", mimeType: "image/png", buffer: TINY_PNG },
          },
        }
      );
      expect(over.status()).toBe(422);
      const overJson = await over.json();
      expect(overJson.error.code).toBe("PHOTO_LIMIT");
      expect(overJson.error.message).toContain(String(PHOTO_LIMIT));
    } finally {
      await sweepE2EArea(page, areaName);
    }
  });

  test("optional additions after outcome — existing photos stay read-only", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await login(page);
    const areaName = `E2E Post-Outcome Area ${Date.now()}`;
    await openMap(page);
    await drawBoxAndSave(page, areaName, "Property");

    try {
      const area = await waitForAreaByName(page, areaName);
      expect(area, "drawn area must exist via the API").toBeTruthy();
      const base = `/api/v1/map-areas/${area!.id}/photos`;

      // PROPERTY outcomes need ≥1 evidence photo first.
      const first = await page.request.post(base, {
        multipart: {
          file: { name: "pre-outcome.png", mimeType: "image/png", buffer: TINY_PNG },
        },
      });
      expect(first.status()).toBe(201);
      const firstBody = await first.json();
      const firstId: string = firstBody.data.id;

      // Record the outcome (one-step RECORDED flow).
      const patch = await page.request.patch(`/api/v1/map-areas/${area!.id}`, {
        data: { property_outcome: { type: "APPROVED_PROPERTY" } },
      });
      expect(patch.status()).toBeLessThan(300);

      // Meta reports the lock.
      const list1 = await (await page.request.get(base)).json();
      expect(list1.meta.locked).toBe(true);

      // Optional additions are still allowed under the cap.
      const second = await page.request.post(base, {
        multipart: {
          file: { name: "post-outcome.png", mimeType: "image/png", buffer: TINY_PNG },
        },
      });
      expect(second.status(), "addition after outcome must succeed").toBe(201);

      // The pre-outcome photo can no longer be deleted.
      const del = await page.request.delete(`${base}/${firstId}`);
      expect(del.status()).toBe(403);
      expect((await del.json()).error.code).toBe("LOCKED");

      // The panel still offers the upload controls (adds-only UI).
      await page.goto(`/map?area=${area!.id}`);
      await expect(page.getByRole("heading", { level: 3, name: areaName })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(`2 of ${PHOTO_LIMIT} photos · outcome recorded`)).toBeVisible();
      await expect(page.getByText("Upload Photos")).toBeVisible();
      await expect(page.getByText(/optional additions are still allowed/)).toBeVisible();
    } finally {
      // Photo DELETEs correctly 403 on locked areas — the area delete
      // cascades the photo rows (storage objects are tiny test PNGs).
      await sweepE2EArea(page, areaName);
    }
  });
});
