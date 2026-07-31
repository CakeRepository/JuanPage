import { expect, test } from "@playwright/test";

test("projection interaction scopes every dependent representation", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Northstar Operations Control Room" })).toBeVisible();

  const projection = page.locator('[data-projection-id="projection:revenue"]');
  await expect(projection.locator("[data-datum-id]")) .toHaveCount(3);
  await expect(page.locator('[data-object-id="e:finance:july"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:june"]')).toHaveCount(0);

  await projection.locator('[data-datum-id="2026-06"]').click();

  await expect(page.getByText("Prop Period: 2026-06")).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:june"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:july"]')).toHaveCount(0);
});

test("only bound information receives interactive semantics", async ({ page }) => {
  await page.goto("./");

  const inertCustomer = page.locator('[data-object-id="e:acme"]');
  await expect(inertCustomer).not.toHaveAttribute("role", "button");
  await expect(inertCustomer).not.toHaveAttribute("tabindex", "0");

  const inspectableRelease = page.locator('[data-object-id="e:release"]');
  await expect(inspectableRelease).toHaveAttribute("role", "button");
  await expect(inspectableRelease).toHaveAttribute("tabindex", "0");
  await inspectableRelease.press("Enter");
  await expect(page.locator(".jp-u-inspector")).toContainText("Agent 2.4 rollout");
});

test("typed field edits remain visible after adaptive rerender", async ({ page }) => {
  await page.goto("./");

  const ring = page.locator('[data-affordance-id="a:ring"] select');
  await expect(ring).toHaveValue("pilot");
  await ring.selectOption("broad");
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("broad");
  await expect(page.locator('[data-object-id="e:release"]')).toContainText("Broad");
});
