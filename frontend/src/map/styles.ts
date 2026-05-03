import type { StyleSpecification } from "maplibre-gl";

export const REACH_SOURCE_ID = "sword-reaches";
export const REACH_LAYER_ID = "sword-reaches-line";
export const LIGHT_BASEMAP_LAYER_ID = "carto-light";
export const SATELLITE_BASEMAP_LAYER_ID = "esri-satellite";
export type BasemapMode = "light" | "satellite";

export const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
    esriSatellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [
    {
      id: LIGHT_BASEMAP_LAYER_ID,
      type: "raster",
      source: "carto",
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: SATELLITE_BASEMAP_LAYER_ID,
      type: "raster",
      source: "esriSatellite",
      minzoom: 0,
      maxzoom: 20,
      layout: {
        visibility: "none",
      },
    },
  ],
};
