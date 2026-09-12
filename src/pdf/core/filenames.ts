const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function safeBaseName(name: string, fallback = "document"): string {
  const withoutExtension = name.replace(/\.pdf$/i, "");
  const cleaned = withoutExtension.replace(INVALID_FILENAME_CHARS, "-").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

export function zeroPad(value: number, length = 3): string {
  return String(value).padStart(length, "0");
}

export function pageFileName(baseName: string, pageNumber: number, extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase();
  return `${safeBaseName(baseName)}-page-${zeroPad(pageNumber)}.${ext}`;
}

export function exportFileName(baseName: string, suffix: string): string {
  const normalized = suffix.replace(/^[-_\s]+/, "").replace(/\s+/g, "-").toLowerCase();
  return normalized
    ? `${safeBaseName(baseName)}-${normalized}.pdf`
    : `${safeBaseName(baseName)}.pdf`;
}

export function ensureExtension(name: string, extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase();
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}
