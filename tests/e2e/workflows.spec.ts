import { test, expect } from "@playwright/test";
import { expectDownload, fixture, uploadPdf } from "./helpers";

test.describe("V1.0 workflows", () => {
  test("upload -> edit -> export", async ({ page }) => {
    await page.goto("/pdf/edit");
    await uploadPdf(page, fixture("one-page.pdf"));
    await expect(page.getByText("Page 1 of 1")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Text" }).click();
    const canvas = page.locator("canvas.upper-canvas").last();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      // Click near the very top of the page to confirm the overlay covers it.
      await page.mouse.click(box.x + box.width / 2, box.y + 24);
    }
    // A text object should now be selected, revealing its properties.
    await expect(page.getByText("Font")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.type("Top of page");
    const download = await expectDownload(
      page,
      () => page.getByRole("button", { name: /Save \/ Export/ }).click(),
      ".pdf",
    );
    expect(download.suggestedFilename()).toBe("one-page-edited.pdf");
  });
  test("upload A+B -> merge -> download", async ({ page }) => {
    await page.goto("/pdf/merge");
    await uploadPdf(page, fixture("portrait.pdf"));
    await expect(page.getByText("portrait.pdf")).toBeVisible({ timeout: 30_000 });
    await uploadPdf(page, fixture("landscape.pdf"));
    await expect(page.getByText("landscape.pdf")).toBeVisible({ timeout: 30_000 });
    const mergeButton = page.getByRole("button", { name: "Merge PDFs" });
    await expect(mergeButton).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Page 2/ }).first()).toBeVisible({ timeout: 60_000 });
    const download = await expectDownload(page, () => mergeButton.click(), ".pdf");
    expect(download.suggestedFilename()).toBe("portrait-merged.pdf");
  });

  test("upload -> split -> zip", async ({ page }) => {
    await page.goto("/pdf/split");
    await uploadPdf(page, fixture("mixed-sizes.pdf"));
    await expect(page.getByText("Page 1 of 4").or(page.locator("text=4 pages")).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.getByLabel("Split every page into its own file").check();
    const download = await expectDownload(
      page,
      () => page.getByRole("button", { name: "Split PDF" }).click(),
      ".zip",
    );
    expect(download.suggestedFilename()).toBe("mixed-sizes-split.zip");
  });

  test("upload -> pdf to png -> download", async ({ page }) => {
    await page.goto("/pdf/pdf-to-png");
    await uploadPdf(page, fixture("one-page.pdf"));
    await expect(page.getByText(/All pages/)).toBeVisible({ timeout: 60_000 });
    const download = await expectDownload(
      page,
      () => page.getByRole("button", { name: "Convert and download" }).click(),
      ".png",
    );
    expect(download.suggestedFilename()).toBe("one-page-page-001.png");
  });

  test("images -> reorder -> pdf -> download", async ({ page }) => {
    await page.goto("/pdf/images-to-pdf");
    await page
      .locator('input[type="file"][accept*="image"]')
      .first()
      .setInputFiles([fixture("test-image.png"), fixture("test-image-2.png")]);
    await expect(page.getByText("Page size")).toBeVisible({ timeout: 30_000 });
    const download = await expectDownload(
      page,
      () => page.getByRole("button", { name: "Create PDF" }).click(),
      ".pdf",
    );
    expect(download.suggestedFilename()).toContain(".pdf");
  });

  test("sign -> position signature -> export", async ({ page }) => {
    await page.goto("/pdf/sign");
    await uploadPdf(page, fixture("one-page.pdf"));
    await expect(page.getByText("Page 1 of 1")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Signature", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByText("Create signature")).toBeVisible();

    const pad = page.getByLabel("Signature drawing area");
    const box = await pad.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 40, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 8 });
      await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await page.getByRole("button", { name: "Add signature" }).last().click();

    const download = await expectDownload(
      page,
      () => page.getByRole("button", { name: /Save \/ Export/ }).click(),
      ".pdf",
    );
    expect(download.suggestedFilename()).toBe("one-page-signed.pdf");
  });
});
