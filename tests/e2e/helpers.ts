import { expect, type Page } from "@playwright/test";
import { join } from "node:path";

export const FIXTURES = join(process.cwd(), "tests", "fixtures", "generated");

export function fixture(name: string): string {
  return join(FIXTURES, name);
}

export async function uploadPdf(page: Page, file: string, index = 0): Promise<void> {
  const inputs = page.locator('input[type="file"][accept*="pdf"]');
  await inputs.nth(index).setInputFiles(file);
}

export async function uploadImages(page: Page, files: string[], index = 0): Promise<void> {
  const inputs = page.locator('input[type="file"][accept*="image"]');
  await inputs.nth(index).setInputFiles(files);
}

export async function expectDownload(page: Page, action: () => Promise<void>, extension: string) {
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await action();
  const download = await downloadPromise;
  const name = download.suggestedFilename();
  expect(name.toLowerCase().endsWith(extension)).toBeTruthy();
  return download;
}

export async function expectStatus(page: Page, text: RegExp | string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 60_000 });
}
