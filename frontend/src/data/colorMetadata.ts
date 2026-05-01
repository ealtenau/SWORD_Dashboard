import type { ColorMetadata } from "../types";

const pmtilesUrl = import.meta.env.VITE_SWORD_REACHES_PMTILES;
const explicitColorMetadataUrl = import.meta.env.VITE_SWORD_COLOR_BINS_JSON;

export function getColorMetadataUrl() {
  if (explicitColorMetadataUrl) {
    return explicitColorMetadataUrl;
  }

  if (!pmtilesUrl?.endsWith(".pmtiles")) {
    return null;
  }

  return pmtilesUrl.replace(/\.pmtiles$/, ".colors.json");
}

export async function loadColorMetadata(): Promise<ColorMetadata | null> {
  const url = getColorMetadataUrl();
  if (!url) {
    return null;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load color metadata from ${url}: ${response.status}`);
  }

  return (await response.json()) as ColorMetadata;
}
