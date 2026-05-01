/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SWORD_REACHES_PMTILES?: string;
  readonly VITE_SWORD_REACHES_SOURCE_LAYER?: string;
  readonly VITE_SWORD_COLOR_BINS_JSON?: string;
  readonly VITE_MAP_CENTER_LON?: string;
  readonly VITE_MAP_CENTER_LAT?: string;
  readonly VITE_MAP_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
