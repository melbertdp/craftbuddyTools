export type PhotoSize = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export type PaperSize = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export type SheetCell = {
  id: string;
  photoTypeId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function fitCropArea(area: CropArea, aspectRatio: number, imageWidth: number, imageHeight: number): CropArea {
  let width = area.width;
  let height = area.height;
  if (width / height > aspectRatio) width = height * aspectRatio;
  else height = width / aspectRatio;
  width = Math.min(width, imageWidth);
  height = Math.min(height, imageHeight);
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  return {
    x: Math.max(0, Math.min(imageWidth - width, centerX - width / 2)),
    y: Math.max(0, Math.min(imageHeight - height, centerY - height / 2)),
    width,
    height,
  };
}

export const PHOTO_SIZES: readonly PhotoSize[] = [
  { id: "standard", label: "Standard", widthMm: 31, heightMm: 41 },
  { id: "1x1in", label: "1 × 1 in", widthMm: 25.4, heightMm: 25.4 },
  { id: "2x2in", label: "2 × 2 in", widthMm: 50.8, heightMm: 50.8 },
  { id: "passport", label: "Passport", widthMm: 35, heightMm: 45 },
];

export const PAPER_SIZES: readonly PaperSize[] = [
  { id: "3r", label: "3R", widthMm: 88.9, heightMm: 127 },
  { id: "4r", label: "4R", widthMm: 101.6, heightMm: 152.4 },
  { id: "5r", label: "5R", widthMm: 127, heightMm: 177.8 },
  { id: "6r", label: "6R", widthMm: 152.4, heightMm: 203.2 },
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "letter", label: "Letter", widthMm: 215.9, heightMm: 279.4 },
  { id: "legal", label: "Legal", widthMm: 215.9, heightMm: 355.6 },
];

export function orientedPaper(paper: PaperSize, orientation: "portrait" | "landscape") {
  return orientation === "portrait"
    ? { widthMm: paper.widthMm, heightMm: paper.heightMm }
    : { widthMm: paper.heightMm, heightMm: paper.widthMm };
}

export function packPhotoItems(
  paperWidthMm: number,
  paperHeightMm: number,
  requests: readonly { photoTypeId: string; widthMm: number; heightMm: number; quantity: number }[],
  marginMm = 0,
  gapMm = 0,
): SheetCell[] {
  const innerWidth = Math.max(0, paperWidthMm - marginMm * 2);
  const innerHeight = Math.max(0, paperHeightMm - marginMm * 2);
  const items = requests
    .flatMap((request) => Array.from({ length: Math.max(0, Math.floor(request.quantity)) }, () => request))
    .sort((a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm || b.widthMm * b.heightMm - a.widthMm * a.heightMm);

  type Column = { x: number; width: number; usedHeight: number };
  type Shelf = { y: number; height: number; cursorX: number; columns: Column[] };

  const shelves: Shelf[] = [];
  const cells: SheetCell[] = [];
  let index = 0;

  for (const item of items) {
    if (item.widthMm > innerWidth + 1e-6 || item.heightMm > innerHeight + 1e-6) continue;

    let placed = false;
    for (const shelf of shelves) {
      if (item.heightMm > shelf.height + 1e-6) continue;
      for (const column of shelf.columns) {
        if (item.widthMm > column.width + 1e-6) continue;
        const offsetY = column.usedHeight > 0 ? column.usedHeight + gapMm : 0;
        if (offsetY + item.heightMm <= shelf.height + 1e-6) {
          cells.push({ id: `${item.photoTypeId}-${index}`, photoTypeId: item.photoTypeId, xMm: marginMm + column.x, yMm: marginMm + shelf.y + offsetY, widthMm: item.widthMm, heightMm: item.heightMm });
          column.usedHeight = offsetY + item.heightMm;
          index += 1;
          placed = true;
          break;
        }
      }
      if (placed) break;
      if (shelf.cursorX + item.widthMm <= innerWidth + 1e-6) {
        shelf.columns.push({ x: shelf.cursorX, width: item.widthMm, usedHeight: item.heightMm });
        cells.push({ id: `${item.photoTypeId}-${index}`, photoTypeId: item.photoTypeId, xMm: marginMm + shelf.cursorX, yMm: marginMm + shelf.y, widthMm: item.widthMm, heightMm: item.heightMm });
        shelf.cursorX += item.widthMm + gapMm;
        index += 1;
        placed = true;
        break;
      }
    }
    if (placed) continue;

    const y = shelves.length ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height + gapMm : 0;
    if (y + item.heightMm > innerHeight + 1e-6) continue;
    shelves.push({ y, height: item.heightMm, cursorX: item.widthMm + gapMm, columns: [{ x: 0, width: item.widthMm, usedHeight: item.heightMm }] });
    cells.push({ id: `${item.photoTypeId}-${index}`, photoTypeId: item.photoTypeId, xMm: marginMm, yMm: marginMm + y, widthMm: item.widthMm, heightMm: item.heightMm });
    index += 1;
  }

  return cells;
}

export function hasOverlaps(cells: readonly SheetCell[]) {
  return cells.some((a, index) => cells.slice(index + 1).some((b) =>
    a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm &&
    a.yMm < b.yMm + b.heightMm && a.yMm + a.heightMm > b.yMm,
  ));
}
