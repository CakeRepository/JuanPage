import { expect, test } from "@playwright/test";

test("one schema opens in one universal renderer", async ({ page, context }) => {
  await page.goto("builder.html");
  await expect(page.getByRole("heading", { name: "Describe a world. Get an interface." })).toBeVisible();
  await expect(page.getByText("Valid JuanPage 1.0")).toBeVisible();
  await page.getByRole("button", { name: "Generate share link" }).click();
  await expect(page.locator('input[type="url"]')).toHaveValue(/#v=3&enc=gz&data=/);
  const url = await page.locator('input[type="url"]').inputValue();
  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: "The Human Interface for Agentic Work" })).toBeVisible();
  await expect(viewer.locator(".jp-u-card").first()).toBeVisible();
  await viewer.getByRole("button", { name: "Data" }).click();
  await expect(viewer.locator(".jp-u-table")).toBeVisible();
  await expect(viewer.getByText("Runtime compute credits")).toBeVisible();
  await viewer.getByRole("button", { name: "Flow" }).click();
  await expect(viewer.locator(".jp-u-flow")).toBeVisible();
});
