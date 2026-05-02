import { OVERVIEW_TILE, type ContinentTileConfig } from "./continents";
import type { ColorMetadata, ColorMetadataByContinent } from "../types";

async function loadOneColorMetadata(url: string): Promise<ColorMetadata | null> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load color metadata from ${url}: ${response.status}`);
  }

  return (await response.json()) as ColorMetadata;
}

export async function loadColorMetadataByContinent(
  continentTiles: ContinentTileConfig[],
): Promise<ColorMetadataByContinent> {
  const entries = await Promise.all(
    [...(OVERVIEW_TILE ? [OVERVIEW_TILE] : []), ...continentTiles].map(async (continent) => {
      try {
        const metadata = await loadOneColorMetadata(continent.colorsUrl);
        return [continent.id, metadata] as const;
      } catch (error) {
        console.warn(error);
        return [continent.id, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}
