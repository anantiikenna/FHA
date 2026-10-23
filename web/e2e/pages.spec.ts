import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const SIDEBAR_ROUTES: { name: string; url: RegExp }[] = [
  { name: "Dashboard", url: /\/dashboard$/ },
  { name: "Estate Map", url: /\/map$/ },
  { name: "Properties", url: /\/plots$/ },
  { name: "Approvals", url: /\/approvals$/ },
  { name: "Documents", url: /\/documents$/ },
  { name: "Audit Log", url: /\/audit$/ },
];

test.describe("App shell: every sidebar route loads", () => {
  for (const route of SIDEBAR_ROUTES) {
    test(`${route.name} renders with a page heading`, async ({ page }) => {
      await login(page);
      // Scope to the sidebar navigation: the Dashboard quick-actions card
      // also links to some of these routes (it streams in separately), so an
      // unscoped getByRole sees two matches and hits strict mode.
      await page
        .getByRole("navigation")
        .getByRole("link", { name: route.name, exact: true })
        .click();
      await expect(page).toHaveURL(route.url);
      await expect(
        page.getByRole("heading", { level: 1 })
      ).toBeVisible();
      await expect(
        page.getByText(/something went wrong|error occurred|failed to load/i)
      ).toBeHidden();
    });
  }
});
