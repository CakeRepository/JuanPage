import { expect, test } from "@playwright/test";

test("one semantic schema opens in one adaptive renderer", async ({ page, context }) => {
  await page.goto("builder.html");
  await expect(page.getByRole("heading", { name: "Describe meaning. Get a working surface." })).toBeVisible();
  await expect(page.getByText("Valid M1 packet")).toBeVisible();

  await page.getByRole("button", { name: "Generate share link" }).click();
  await expect(page.locator('input[type="url"]')).toHaveValue(/#v=5&enc=gz&data=/u);
  const url = await page.locator('input[type="url"]').inputValue();

  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: "Meaning is the Interface" })).toBeVisible();
  await expect(viewer.locator(".jp-u-shell")).toHaveCount(1);
  await expect(viewer.locator('.jp-u-card[data-object-id="e:north"]')).toContainText("Shared semantic state");
  await expect(viewer.locator(".jp-u-card[data-object-id]").first()).toBeVisible();
  await expect(viewer.locator(".jp-u-lenses, .jp-moment, .jp-document")).toHaveCount(0);
});
