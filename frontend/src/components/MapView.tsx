import { useEffect, useRef, useState } from "react";
import maplibregl, { MapLayerMouseEvent } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { OVERVIEW_TILE, type ContinentTileConfig, type ContinentTilePart } from "../data/continents";
import { getOverviewLinePaint, getReachLinePaint, getSelectedReachPaint } from "../map/layers";
import { BASE_STYLE, LIGHT_BASEMAP_LAYER_ID, SATELLITE_BASEMAP_LAYER_ID, type BasemapMode } from "../map/styles";
import type { ColorMetadataByContinent, LayerMode, ReachProperties, ReachSearchSelection } from "../types";

type MapViewProps = {
  activeLayerMode: LayerMode;
  colorMetadataByContinent: ColorMetadataByContinent;
  continentTiles: ContinentTileConfig[];
  searchSelection: ReachSearchSelection | null;
  selectedReachId: string | null;
  onReachHover: (properties: ReachProperties | null) => void;
  onReachSelect: (properties: ReachProperties) => void;
};

const initialCenter: [number, number] = [
  Number(import.meta.env.VITE_MAP_CENTER_LON ?? 135),
  Number(import.meta.env.VITE_MAP_CENTER_LAT ?? -20),
];
const initialZoom = Number(import.meta.env.VITE_MAP_ZOOM ?? 3);
const detailMinZoom = Number(import.meta.env.VITE_SWORD_DETAIL_MIN_ZOOM ?? 4);

function normalizePmtilesUrl(url: string) {
  return url.startsWith("pmtiles://") ? url : `pmtiles://${url}`;
}

function sourceId(partId: string) {
  return `sword-reaches-${partId}`;
}

function reachLayerId(partId: string) {
  return `sword-reaches-${partId}-line`;
}

function selectedLayerId(partId: string) {
  return `sword-reaches-${partId}-selected`;
}

const overviewSourceId = "sword-reaches-global-overview";
const overviewLayerId = "sword-reaches-global-overview-line";

const TOOLTIP_FIELDS: Record<LayerMode, { field: string; label: string }[]> = {
  reach_id: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "rch_id_up", label: "Upstream" },
    { field: "rch_id_dn", label: "Downstream" },
    { field: "lat", label: "Lat" },
    { field: "lon", label: "Lon" },
  ],
  wse: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "wse", label: "WSE" },
  ],
  width: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "width", label: "Width" },
  ],
  facc: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "facc", label: "Flow Accum." },
  ],
  dist_out: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "dist_out", label: "Dist. Out" },
  ],
  slope: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "slope", label: "Slope" },
  ],
  n_chan_max: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "n_chan_max", label: "Channels" },
  ],
  strm_order: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "strm_order", label: "Stream Order" },
  ],
  swot_obs: [
    { field: "reach_id", label: "Reach ID" },
    { field: "river_name", label: "River" },
    { field: "swot_obs", label: "SWOT Obs." },
    { field: "pass_ids", label: "Pass IDs" },
  ],
};

function firstFeatureProperties(event: MapLayerMouseEvent, continent: ContinentTileConfig): ReachProperties | null {
  const feature = event.features?.[0];
  if (!feature?.properties) {
    return null;
  }

  return {
    ...(feature.properties as ReachProperties),
    _continent_id: continent.id,
    _continent_name: continent.name,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return character;
    }
  });
}

function tooltipValue(properties: ReachProperties, field: string) {
  if (field === "lat") {
    return properties.lat ?? properties.y;
  }

  if (field === "lon") {
    return properties.lon ?? properties.x;
  }

  if (field === "pass_ids") {
    return properties.pass_ids ?? properties.swot_orbit;
  }

  return properties[field];
}

function formatTooltipValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "--";
  }

  return String(value);
}

function tooltipHtml(properties: ReachProperties, layerMode: LayerMode) {
  const rows = TOOLTIP_FIELDS[layerMode]
    .map(({ field, label }) => {
      const value = formatTooltipValue(tooltipValue(properties, field));
      return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    })
    .join("");

  return `<dl class="reach-tooltip-list">${rows}</dl>`;
}

export function MapView({
  activeLayerMode,
  colorMetadataByContinent,
  continentTiles,
  searchSelection,
  selectedReachId,
  onReachHover,
  onReachSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const continentTilesRef = useRef(continentTiles);
  const onReachHoverRef = useRef(onReachHover);
  const onReachSelectRef = useRef(onReachSelect);
  const activeLayerModeRef = useRef(activeLayerMode);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("light");
  const [mouseCoordinates, setMouseCoordinates] = useState<[number, number] | null>(null);

  useEffect(() => {
    onReachHoverRef.current = onReachHover;
    onReachSelectRef.current = onReachSelect;
  }, [onReachHover, onReachSelect]);

  useEffect(() => {
    activeLayerModeRef.current = activeLayerMode;
  }, [activeLayerMode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    hoverPopupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "reach-tooltip-popup",
      maxWidth: "320px",
      offset: 12,
    });

    map.on("mousemove", (event) => {
      setMouseCoordinates([event.lngLat.lat, event.lngLat.lng]);
    });

    map.on("mouseout", () => {
      setMouseCoordinates(null);
    });

    map.on("load", () => {
      const initialContinentTiles = continentTilesRef.current;

      if (OVERVIEW_TILE) {
        map.addSource(overviewSourceId, {
          type: "vector",
          url: normalizePmtilesUrl(OVERVIEW_TILE.pmtilesUrl),
        });

        map.addLayer({
          id: overviewLayerId,
          type: "line",
          source: overviewSourceId,
          "source-layer": OVERVIEW_TILE.sourceLayer,
          minzoom: OVERVIEW_TILE.minzoom,
          maxzoom: OVERVIEW_TILE.maxzoom,
          paint: getOverviewLinePaint(activeLayerMode, colorMetadataByContinent[OVERVIEW_TILE.id]),
        });
      }

      initialContinentTiles.forEach((continent) => {
        continent.parts.forEach((part: ContinentTilePart) => {
          map.addSource(sourceId(part.id), {
            type: "vector",
            url: normalizePmtilesUrl(part.pmtilesUrl),
          });

          map.addLayer({
            id: reachLayerId(part.id),
            type: "line",
            source: sourceId(part.id),
            "source-layer": continent.sourceLayer,
            minzoom: detailMinZoom,
            paint: getReachLinePaint(activeLayerMode, colorMetadataByContinent[continent.id]),
          });

          map.addLayer({
            id: selectedLayerId(part.id),
            type: "line",
            source: sourceId(part.id),
            "source-layer": continent.sourceLayer,
            minzoom: detailMinZoom,
            filter: ["==", ["to-string", ["get", "reach_id"]], ""],
            paint: getSelectedReachPaint(),
          });

          map.on("mouseenter", reachLayerId(part.id), () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", reachLayerId(part.id), () => {
            map.getCanvas().style.cursor = "";
            hoverPopupRef.current?.remove();
            onReachHoverRef.current(null);
          });

          map.on("mousemove", reachLayerId(part.id), (event) => {
            const properties = firstFeatureProperties(event, continent);
            onReachHoverRef.current(properties);

            if (properties) {
              hoverPopupRef.current
                ?.setLngLat(event.lngLat)
                .setHTML(tooltipHtml(properties, activeLayerModeRef.current))
                .addTo(map);
            }
          });

          map.on("click", reachLayerId(part.id), (event) => {
            const properties = firstFeatureProperties(event, continent);
            if (properties) {
              onReachSelectRef.current(properties);
            }
          });
        });
      });
    });

    mapRef.current = map;

    return () => {
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (OVERVIEW_TILE && map.getLayer(overviewLayerId)) {
      const overviewPaint = getOverviewLinePaint(activeLayerMode, colorMetadataByContinent[OVERVIEW_TILE.id]);
      Object.entries(overviewPaint ?? {}).forEach(([property, value]) => {
        map.setPaintProperty(overviewLayerId, property, value);
      });
    }

    continentTiles.forEach((continent) => {
      continent.parts.forEach((part) => {
        const layerId = reachLayerId(part.id);
        if (!map.getLayer(layerId)) {
          return;
        }

        const paint = getReachLinePaint(activeLayerMode, colorMetadataByContinent[continent.id]);
        Object.entries(paint ?? {}).forEach(([property, value]) => {
          map.setPaintProperty(layerId, property, value);
        });
      });
    });
  }, [activeLayerMode, colorMetadataByContinent, continentTiles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    continentTiles.forEach((continent) => {
      continent.parts.forEach((part) => {
        const layerId = selectedLayerId(part.id);
        if (!map.getLayer(layerId)) {
          return;
        }

        map.setFilter(layerId, ["==", ["to-string", ["get", "reach_id"]], selectedReachId ?? ""]);
      });
    });
  }, [continentTiles, selectedReachId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const applyBasemapMode = () => {
      if (!map.getLayer(LIGHT_BASEMAP_LAYER_ID) || !map.getLayer(SATELLITE_BASEMAP_LAYER_ID)) {
        return;
      }

      map.setLayoutProperty(
        LIGHT_BASEMAP_LAYER_ID,
        "visibility",
        basemapMode === "light" ? "visible" : "none",
      );
      map.setLayoutProperty(
        SATELLITE_BASEMAP_LAYER_ID,
        "visibility",
        basemapMode === "satellite" ? "visible" : "none",
      );
    };

    if (map.isStyleLoaded()) {
      applyBasemapMode();
    } else {
      map.once("load", applyBasemapMode);
    }
  }, [basemapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchSelection?.records.length) {
      return;
    }

    const flyToSelection = () => {
      if (searchSelection.bbox) {
        map.fitBounds(
          [
            [searchSelection.bbox[0], searchSelection.bbox[1]],
            [searchSelection.bbox[2], searchSelection.bbox[3]],
          ],
          {
            duration: 900,
            maxZoom: searchSelection.type === "reach" ? 11 : 8,
            padding: 80,
          },
        );
        return;
      }

      const center = searchSelection.records.reduce(
        (sum, record) => [sum[0] + record.lon, sum[1] + record.lat],
        [0, 0],
      );
      map.flyTo({
        center: [center[0] / searchSelection.records.length, center[1] / searchSelection.records.length],
        duration: 900,
        zoom: searchSelection.type === "reach" ? 10 : 6,
      });
    };

    if (map.isStyleLoaded()) {
      flyToSelection();
    } else {
      map.once("load", flyToSelection);
    }
  }, [searchSelection]);

  return (
    <div className="map-wrap">
      <div className="map-container" ref={containerRef} />
      <div className="coordinate-readout" aria-live="polite">
        {mouseCoordinates ? (
          <>
            <span>Lat {mouseCoordinates[0].toFixed(5)}</span>
            <span>Lon {mouseCoordinates[1].toFixed(5)}</span>
          </>
        ) : (
          <span>Lat -- Lon --</span>
        )}
      </div>
      <div className="basemap-toggle" aria-label="Basemap selector">
        <button
          aria-label="Use light basemap"
          className={basemapMode === "light" ? "active" : ""}
          onClick={() => setBasemapMode("light")}
          title="Light basemap"
          type="button"
        >
          <span className="basemap-icon light" aria-hidden="true" />
          <span>Light</span>
        </button>
        <button
          aria-label="Use satellite basemap"
          className={basemapMode === "satellite" ? "active" : ""}
          onClick={() => setBasemapMode("satellite")}
          title="Satellite basemap"
          type="button"
        >
          <span className="basemap-icon satellite" aria-hidden="true" />
          <span>Satellite</span>
        </button>
      </div>
      {continentTiles.length === 0 && !OVERVIEW_TILE ? (
        <div className="map-empty-state">
          <strong>Map shell ready.</strong>
          <span>Set VITE_SWORD_CONTINENTS to one or more continent IDs.</span>
        </div>
      ) : null}
    </div>
  );
}
