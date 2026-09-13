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
  const right = paperWidthMm - marginMm;
  const bottom = paperHeightMm - marginMm;
  const rows: { x: number; y: number; height: number }[] = [];
  const cells: SheetCell[] = [];
  let index = 0;

  for (const request of [...requests].sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm)) {
    for (let copy = 0; copy < Math.max(0, Math.floor(request.quantity)); copy += 1) {
      if (request.widthMm > right - marginMm || request.heightMm > bottom - marginMm) continue;
      let row = rows.find((candidate) => candidate.x + request.widthMm <= right + 1e-6);
      if (!row) {
        const y = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height + gapMm : marginMm;
        if (y + request.heightMm > bottom + 1e-6) continue;
        row = { x: marginMm, y, height: request.heightMm };
        rows.push(row);
      }
      cells.push({ id: `${request.photoTypeId}-${index}`, photoTypeId: request.photoTypeId, xMm: row.x, yMm: row.y, widthMm: request.widthMm, heightMm: request.heightMm });
      row.x += request.widthMm + gapMm;
      row.height = Math.max(row.height, request.heightMm);
      index += 1;
    }
  }
  return cells;
}

export function hasOverlaps(cells: readonly SheetCell[]) {
  return cells.some((a, index) => cells.slice(index + 1).some((b) =>
    a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm &&
    a.yMm < b.yMm + b.heightMm && a.yMm + a.heightMm > b.yMm,
  ));
}
