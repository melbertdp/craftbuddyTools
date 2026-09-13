import { test, expect } from "@playwright/test";
import { fixture } from "./helpers";

test.describe("print estimator", () => {
  test("keeps local analysis independent from AI analysis", async ({ page }) => {
    await page.goto("/print-estimator");

    const upload = page.locator('input[type="file"]').first();
    const analyze = page.getByRole("button", { name: "Analyze file" });
    const identify = page.getByRole("button", { name: "Identify with AI" });

    await expect(analyze).toHaveCount(0);
    await expect(identify).toHaveCount(0);

    await upload.setInputFiles(fixture("mixed-sizes.pdf"));
    await expect(analyze).toBeEnabled();
    await expect(identify).toBeEnabled();

    await analyze.click();
    await expect(page.getByText("4 pages analyzed", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Re-analyze file" })).toBeEnabled();
    await expect(identify).toBeEnabled();
    await expect(page.getByText("₱5.00 / page · 4 pages")).toBeVisible();
  });

  test("runs AI only when the AI button is clicked and applies its result", async ({ page }) => {
    let aiCalls = 0;
    await page.route("**/api/ai/identify", async (route) => {
      aiCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: "AI classified this as a full-color image.",
          classification: {
            contentType: "image_only",
            colorClass: "full_color",
            confidence: 0.98,
          },
        }),
      });
    });
    await page.goto("/print-estimator");

    const upload = page.locator('input[type="file"]').first();
    await upload.setInputFiles(fixture("one-page.pdf"));
    await expect(page.getByRole("button", { name: "Identify with AI" })).toBeEnabled();
    expect(aiCalls).toBe(0);

    await page.getByRole("button", { name: "Analyze file" }).click();
    await expect(page.getByText("1 page analyzed", { exact: false })).toBeVisible({ timeout: 60_000 });
    expect(aiCalls).toBe(0);

    await page.getByRole("button", { name: "Identify with AI" }).click();
    await expect(page.getByText("AI classified this as a full-color image.")).toBeVisible();
    expect(aiCalls).toBe(1);
    await expect(page.getByRole("button", { name: /Identify with AI \(60s\)/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Re-analyze file" })).toBeEnabled();
  });
});
