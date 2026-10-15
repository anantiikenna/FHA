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
