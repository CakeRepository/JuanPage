import { expect, test } from "@playwright/test";

test("builder generates a link that opens the grocery page", async ({ page, context }) => {
  await page.goto("builder.html");
  await expect(page.getByRole("heading", { name: "Page builder" })).toBeVisible();
  await page.getByRole("button", { name: "Load grocery example" }).click();
  await page.getByRole("button", { name: "Generate link" }).click();
  await expect(page.locator(".builder-link")).toHaveValue(/#(?:v=1&)?data=/);

  const url = await page.locator(".builder-link").inputValue();
  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: /Grocery Plan/i })).toBeVisible();
  await expect(viewer.locator(".jp-product").first()).toBeVisible();
});
