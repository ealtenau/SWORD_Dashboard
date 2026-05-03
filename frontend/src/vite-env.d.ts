/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SWORD_REACHES_PMTILES?: string;
  readonly VITE_SWORD_REACHES_SOURCE_LAYER?: string;
  readonly VITE_SWORD_COLOR_BINS_JSON?: string;
  readonly VITE_SWORD_CONTINENTS?: string;
  readonly VITE_SWORD_TILE_MANIFEST_JSON?: string;
  readonly VITE_SWORD_NODE_BASE_URL?: string;
  readonly VITE_SWORD_REACH_SEARCH_INDEX_JSON?: string;
  readonly VITE_SWORD_OVERVIEW_PMTILES?: string;
  readonly VITE_SWORD_OVERVIEW_COLOR_BINS_JSON?: string;
  readonly VITE_SWORD_OVERVIEW_SOURCE_LAYER?: string;
  readonly VITE_SWORD_OVERVIEW_MAX_ZOOM?: string;
  readonly VITE_SWORD_DETAIL_MIN_ZOOM?: string;
  readonly VITE_MAP_CENTER_LON?: string;
  readonly VITE_MAP_CENTER_LAT?: string;
  readonly VITE_MAP_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
