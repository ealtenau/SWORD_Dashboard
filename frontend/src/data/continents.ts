export type ContinentTileConfig = {
  id: string;
  name: string;
  colorsUrl: string;
  sourceLayer: string;
  parts: ContinentTilePart[];
};

export type ContinentTilePart = {
  id: string;
  pmtilesUrl: string;
};

export type OverviewTileConfig = {
  id: string;
  name: string;
  pmtilesUrl: string;
  colorsUrl: string;
  sourceLayer: string;
  minzoom: number;
  maxzoom: number;
};

const sourceLayer = import.meta.env.VITE_SWORD_REACHES_SOURCE_LAYER ?? "reaches";
const overviewSourceLayer = import.meta.env.VITE_SWORD_OVERVIEW_SOURCE_LAYER ?? sourceLayer;
const enabledContinents = import.meta.env.VITE_SWORD_CONTINENTS ?? "oc";
const legacyPmtilesUrl = import.meta.env.VITE_SWORD_REACHES_PMTILES;
const legacyColorBinsUrl = import.meta.env.VITE_SWORD_COLOR_BINS_JSON;
const overviewPmtilesUrl = import.meta.env.VITE_SWORD_OVERVIEW_PMTILES;
const overviewColorBinsUrl = import.meta.env.VITE_SWORD_OVERVIEW_COLOR_BINS_JSON;
const overviewMaxZoom = Number(import.meta.env.VITE_SWORD_OVERVIEW_MAX_ZOOM ?? 5);
const tileManifestUrl = import.meta.env.VITE_SWORD_TILE_MANIFEST_JSON;

const CONTINENTS: ContinentTileConfig[] = [
  {
    id: "af",
    name: "Africa",
    colorsUrl: "/tiles/af_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "af_reaches", pmtilesUrl: "/tiles/af_reaches.pmtiles" }],
  },
  {
    id: "as",
    name: "Asia",
    colorsUrl: "/tiles/as_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "as_reaches", pmtilesUrl: "/tiles/as_reaches.pmtiles" }],
  },
  {
    id: "eu",
    name: "Europe & Middle East",
    colorsUrl: "/tiles/eu_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "eu_reaches", pmtilesUrl: "/tiles/eu_reaches.pmtiles" }],
  },
  {
    id: "na",
    name: "North America",
    colorsUrl: "/tiles/na_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "na_reaches", pmtilesUrl: "/tiles/na_reaches.pmtiles" }],
  },
  {
    id: "oc",
    name: "Oceania",
    colorsUrl: legacyColorBinsUrl || "/tiles/oc_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "oc_reaches", pmtilesUrl: legacyPmtilesUrl || "/tiles/oc_reaches.pmtiles" }],
  },
  {
    id: "sa",
    name: "South America",
    colorsUrl: "/tiles/sa_reaches.colors.json",
    sourceLayer,
    parts: [{ id: "sa_reaches", pmtilesUrl: "/tiles/sa_reaches.pmtiles" }],
  },
];

type TileManifest = {
  schema_version: number;
  continents: ContinentTileConfig[];
};

function resolveManifestUrl(url: string, manifestUrl: string) {
  if (/^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(url) || url.startsWith("pmtiles://")) {
    return url;
  }

  return new URL(url, manifestUrl).toString();
}

function resolveManifestContinentUrls(
  continents: ContinentTileConfig[],
  manifestUrl: string,
): ContinentTileConfig[] {
  return continents.map((continent) => ({
    ...continent,
    colorsUrl: resolveManifestUrl(continent.colorsUrl, manifestUrl),
    parts: continent.parts.map((part) => ({
      ...part,
      pmtilesUrl: resolveManifestUrl(part.pmtilesUrl, manifestUrl),
    })),
  }));
}

export function getEnabledContinentTiles(continents = CONTINENTS) {
  const requestedIds = enabledContinents
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  if (requestedIds.includes("all")) {
    return continents;
  }

  return continents.filter((continent) => requestedIds.includes(continent.id));
}

function mergeManifestContinents(manifestContinents: ContinentTileConfig[]) {
  const manifestById = new Map(manifestContinents.map((continent) => [continent.id, continent]));

  const mergedDefaults = CONTINENTS.map((defaults) => {
    const continent = manifestById.get(defaults.id);
    if (!continent) {
      return defaults;
    }

    return {
      ...defaults,
      ...continent,
      sourceLayer: continent.sourceLayer || defaults.sourceLayer,
      colorsUrl: continent.colorsUrl || defaults.colorsUrl,
      parts: continent.parts ?? defaults.parts,
    };
  });

  const defaultIds = new Set(CONTINENTS.map((continent) => continent.id));
  const extraManifestContinents = manifestContinents
    .filter((continent) => !defaultIds.has(continent.id))
    .map((continent) => ({
      ...continent,
      sourceLayer: continent.sourceLayer || sourceLayer,
      colorsUrl: continent.colorsUrl || `/tiles/${continent.id}_reaches.colors.json`,
      parts: continent.parts ?? [],
    }));

  return [...mergedDefaults, ...extraManifestContinents];
}

export async function loadContinentTileManifest(): Promise<ContinentTileConfig[]> {
  if (!tileManifestUrl) {
    return getEnabledContinentTiles();
  }

  try {
    const response = await fetch(tileManifestUrl);
    if (!response.ok) {
      throw new Error(`Unable to load tile manifest from ${tileManifestUrl}: ${response.status}`);
    }

    const manifest = (await response.json()) as TileManifest;
    const manifestContinents = resolveManifestContinentUrls(manifest.continents ?? [], tileManifestUrl);
    return getEnabledContinentTiles(mergeManifestContinents(manifestContinents));
  } catch (error) {
    console.warn(error);
    return getEnabledContinentTiles();
  }
}

export const OVERVIEW_TILE: OverviewTileConfig | null = overviewPmtilesUrl
  ? {
      id: "global",
      name: "Global overview",
      pmtilesUrl: overviewPmtilesUrl,
      colorsUrl: overviewColorBinsUrl || overviewPmtilesUrl.replace(/\.pmtiles$/, ".colors.json"),
      sourceLayer: overviewSourceLayer,
      minzoom: 0,
      maxzoom: overviewMaxZoom,
    }
  : null;
