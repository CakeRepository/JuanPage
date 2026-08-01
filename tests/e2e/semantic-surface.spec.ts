import { expect, test } from "@playwright/test";

test("projection interaction scopes every dependent representation", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Northstar Operations Control Room" })).toBeVisible();

  const projection = page.locator('[data-projection-id="projection:revenue"]');
  await expect(projection.locator("[data-datum-id]")).toHaveCount(3);
  await expect(page.locator('[data-object-id="e:finance:july"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:june"]')).toHaveCount(0);

  await projection.locator('[data-datum-id="2026-06"]').click();

  await expect(page.getByText("Prop Period: 2026-06")).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:june"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:finance:july"]')).toHaveCount(0);
});

test("only bound information receives interactive semantics", async ({ page }) => {
  await page.goto("./");

  const inertCustomer = page.locator('.jp-u-card[data-object-id="e:acme"]');
  await expect(inertCustomer).not.toHaveAttribute("role", "button");
  await expect(inertCustomer).not.toHaveAttribute("tabindex", "0");

  const inspectableRelease = page.locator('.jp-u-card[data-object-id="e:release"]');
  await expect(inspectableRelease).toHaveAttribute("role", "button");
  await expect(inspectableRelease).toHaveAttribute("tabindex", "0");
  await inspectableRelease.press("Enter");
  await expect(page.locator(".jp-u-inspector")).toContainText("Agent 2.4 rollout");
});

test("typed field edits survive adaptive rerender and reload", async ({ page }) => {
  await page.goto("./");

  const ring = page.locator('[data-affordance-id="a:ring"] select');
  await expect(ring).toHaveValue("0");
  await ring.selectOption({ label: "Broad" });
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("1");

  await page.reload();
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("1");
});

test("human actions rewrite the share URL and survive reopening", async ({ page, context }) => {
  await page.goto("./");
  const initialUrl = page.url();
  const projection = page.locator('[data-projection-id="projection:revenue"]');

  await projection.locator('[data-datum-id="2026-06"]').click();

  await expect.poll(() => page.url()).not.toBe(initialUrl);
  await expect(page).toHaveURL(/#v=5&enc=gz&data=/);

  const reopened = await context.newPage();
  await reopened.goto(page.url());
  await expect(reopened.getByText("Prop Period: 2026-06")).toBeVisible();
  const ledger = reopened.locator('[data-object-id="juanpager:activity"]');
  await expect(ledger).toContainText("Human activity");
  await expect(ledger).toContainText("Scope");
});

test("search, group filtering, and inspection are portable human state", async ({ page, context }) => {
  await page.goto("./");
  const search = page.getByRole("searchbox", { name: "Search objects" });
  await search.fill("rollout");
  await expect(page.locator('[data-object-id="e:release"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:acme"]')).toHaveCount(0);

  await search.fill("");
  await page.getByRole("combobox", { name: "Filter group" }).selectOption({ label: "Delivery" });
  await expect(page.locator('[data-object-id="e:release"]')).toBeVisible();
  await expect(page.locator('[data-object-id="e:incident"]')).toHaveCount(0);

  await page.locator('[data-object-id="e:release"]').press("Enter");
  await expect(page.locator(".jp-u-inspector")).toContainText("Agent 2.4 rollout");
  await expect.poll(() => page.url()).toMatch(/#v=5&enc=gz&data=/);

  const sharedUrl = page.url();
  const reopened = await context.newPage();
  await reopened.goto(sharedUrl);
  await expect(reopened.getByRole("combobox", { name: "Filter group" })).toHaveValue("Delivery");
  await expect(reopened.locator('[data-object-id="e:release"]')).toBeVisible();
  await expect(reopened.locator('[data-object-id="e:incident"]')).toHaveCount(0);
  await expect(reopened.locator(".jp-u-inspector")).toContainText("Agent 2.4 rollout");
});

test("reset is a typed reversible transaction that restores the original M1 fact", async ({ page, context }) => {
  await page.goto("./");
  const ring = page.locator('[data-affordance-id="a:ring"] select');
  await ring.selectOption({ label: "Broad" });
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("1");
  const broadUrl = page.url();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("0");
  await expect.poll(() => page.url()).not.toBe(broadUrl);
  const resetUrl = page.url();

  const reopened = await context.newPage();
  await reopened.goto(resetUrl);
  await expect(reopened.locator('[data-affordance-id="a:ring"] select')).toHaveValue("0");
  await expect(reopened.locator('[data-object-id="e:release"]')).toContainText("Pilot only");

  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator('[data-affordance-id="a:ring"] select')).toHaveValue("1");
});

test("the same runtime ships as an installable notification-capable offline shell", async ({ page, request }) => {
  await page.goto("./");
  const manifest = await request.get("./manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.name).toBe("JuanPager");
  expect(body.display).toBe("standalone");

  const worker = await request.get("./sw.js");
  expect(worker.ok()).toBeTruthy();
  const workerSource = await worker.text();
  expect(workerSource).toContain('CACHE_VERSION = "juanpager-shell-v2"');
  expect(workerSource).toContain('addEventListener("notificationclick"');
  expect(workerSource).toContain("launchUrl.origin !== scopeUrl.origin");
  expect(workerSource).toContain("launchUrl.pathname.startsWith(scopeUrl.pathname)");
});
