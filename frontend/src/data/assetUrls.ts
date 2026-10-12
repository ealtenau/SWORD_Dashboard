export function versionAssetUrl(url: string, version: string | null): string {
  if (!version || url.startsWith("pmtiles://")) return url;
  const assetUrl = new URL(url);
  assetUrl.searchParams.set("assetVersion", version);
  return assetUrl.toString();
}
