const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_TOOL_ASSET_BASE_URL ?? "").replace(/\/$/, "");

export function toolAsset(path: string): string {
  return `${ASSET_BASE_URL}${path}`;
}
