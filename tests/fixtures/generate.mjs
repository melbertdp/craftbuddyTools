import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "generated");
mkdirSync(outDir, { recursive: true });

// 1x1 transparent PNG and 4x4 opaque PNG (base64).
const TRANSPARENT_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const OPAQUE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFElEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC";

function write(name, bytes) {
  writeFileSync(join(outDir, name), bytes);
}

async function onePage() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText("One page fixture", { x: 72, y: 760, size: 24, font, color: rgb(0.1, 0.1, 0.1) });
  write("one-page.pdf", await pdf.save());
}

async function hundredPages() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 100; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText(`Page ${index + 1}`, { x: 72, y: 760, size: 18, font });
  }
  write("hundred-page.pdf", await pdf.save());
}

async function orientation(name, [width, height]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([width, height]);
  page.drawText(`${name} fixture`, { x: 40, y: height - 60, size: 18, font });
  write(`${name}.pdf`, await pdf.save());
}

async function mixedSizes() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sizes = [
    [595.28, 841.89],
    [841.89, 595.28],
    [612, 792],
    [612, 1008],
  ];
  sizes.forEach((size, index) => {
    const page = pdf.addPage(size);
    page.drawText(`Mixed page ${index + 1}`, { x: 40, y: size[1] - 60, size: 16, font });
  });
  write("mixed-sizes.pdf", await pdf.save());
}

async function imageHeavy() {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(OPAQUE_PNG, "base64"));
  for (let index = 0; index < 5; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 40, y: 300, width: 515, height: 400 });
    page.drawImage(image, { x: 100, y: 100, width: 200, height: 150 });
  }
  write("image-heavy.pdf", await pdf.save());
}

async function vectorHeavy() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    for (let step = 0; step < 200; step += 1) {
      const x = 20 + (step % 20) * 27;
      const y = 40 + Math.floor(step / 20) * 70;
      page.drawCircle({ x, y, size: 9, borderColor: rgb(0.2, 0.4, 0.8), borderWidth: 1 });
      page.drawRectangle({ x: x + 4, y: y + 24, width: 16, height: 16, color: rgb(0.9, 0.5, 0.2) });
    }
    page.drawText("Vector heavy", { x: 40, y: 800, size: 14, font });
  }
  write("vector-heavy.pdf", await pdf.save());
}

async function unicodeText() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText("Unicode / accents: cafe, naive, resume", { x: 60, y: 760, size: 16, font });
  write("unicode-text.pdf", await pdf.save());
}

async function rotatedPages() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  page.setRotation(degrees(90));
  write("rotated.pdf", await pdf.save());
}

async function hugePage() {
  const pdf = await PDFDocument.create();
  pdf.addPage([14400, 14400]);
  write("huge-page.pdf", await pdf.save());
}

async function transparentImage() {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(TRANSPARENT_PNG, "base64"));
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 40, y: 700, width: 200, height: 200 });
  write("transparent-image.pdf", await pdf.save());
}

async function forms() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const form = pdf.getForm();
  form.createTextField("name").addToPage(page, { x: 60, y: 700, width: 200, height: 24 });
  write("forms.pdf", await pdf.save());
}

async function annotations() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText("Annotated", { x: 60, y: 760, size: 16, font });
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 40, borderColor: rgb(1, 0, 0), borderWidth: 2 });
  write("annotations.pdf", await pdf.save());
}

async function corrupted() {
  write("corrupted.pdf", Buffer.from("%PDF-1.4\nthis is not a real pdf structure\n%%EOF"));
}

function notAPdf() {
  write("not-a-pdf.txt", Buffer.from("This is definitely not a PDF file."));
}

await onePage();
await hundredPages();
await orientation("portrait", [595.28, 841.89]);
await orientation("landscape", [841.89, 595.28]);
await mixedSizes();
await imageHeavy();
await vectorHeavy();
await unicodeText();
await rotatedPages();
await hugePage();
await transparentImage();
await forms();
await annotations();
await corrupted();
notAPdf();

console.log(`Fixtures written to ${outDir}`);
