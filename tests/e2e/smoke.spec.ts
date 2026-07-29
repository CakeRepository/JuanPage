import { expect, test } from "@playwright/test";

test("builder generates a moment link that opens the grocery checkout", async ({
  page,
  context,
}) => {
  await page.goto("builder.html");
  await expect(page.getByRole("heading", { name: "Page builder" })).toBeVisible();
  await page.getByRole("button", { name: "Load grocery checkout" }).click();
  await page.getByRole("button", { name: "Generate link" }).click();
  await expect(page.locator(".builder-link")).toHaveValue(/#v=2&enc=gz&data=/);

  const url = await page.locator(".builder-link").inputValue();
  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: /Grocery Checkout/i })).toBeVisible();
  await expect(viewer.locator(".jp-line-product").first()).toBeVisible();
  await expect(viewer.getByRole("heading", { name: "Order summary" })).toBeVisible();
});

test("compiles the Juan dialect into a shareable moment", async ({ page, context }) => {
  await page.goto("builder.html");
  await page.getByRole("button", { name: "Load dialect example" }).click();
  await page.getByRole("button", { name: "Generate link" }).click();
  await expect(page.locator(".builder-link")).toHaveValue(/#v=2&enc=gz&data=/);

  const url = await page.locator(".builder-link").inputValue();
  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: /Grocery Checkout/i })).toBeVisible();
  await expect(viewer.locator(".jp-group").first()).toBeVisible();
});

test("still opens 0.1 component documents", async ({ page, context }) => {
  await page.goto("builder.html");
  await page.getByRole("button", { name: "Load 0.1 example" }).click();
  await page.getByRole("button", { name: "Generate link" }).click();
  await expect(page.locator(".builder-link")).toHaveValue(/#v=1&data=/);

  const url = await page.locator(".builder-link").inputValue();
  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: /Grocery Plan/i })).toBeVisible();
  await expect(viewer.locator(".jp-product").first()).toBeVisible();
});
