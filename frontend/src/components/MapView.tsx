import { useEffect, useRef } from "react";
import maplibregl, { MapLayerMouseEvent } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { OVERVIEW_TILE, type ContinentTileConfig, type ContinentTilePart } from "../data/continents";
import { getOverviewLinePaint, getReachLinePaint, getSelectedReachPaint } from "../map/layers";
import { BASE_STYLE } from "../map/styles";
import type { ColorMetadataByContinent, LayerMode, ReachProperties } from "../types";

type MapViewProps = {
  activeLayerMode: LayerMode;
  colorMetadataByContinent: ColorMetadataByContinent;
  continentTiles: ContinentTileConfig[];
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

export function MapView({
  activeLayerMode,
  colorMetadataByContinent,
  continentTiles,
  selectedReachId,
  onReachHover,
  onReachSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const continentTilesRef = useRef(continentTiles);
  const onReachHoverRef = useRef(onReachHover);
  const onReachSelectRef = useRef(onReachSelect);

  useEffect(() => {
    onReachHoverRef.current = onReachHover;
    onReachSelectRef.current = onReachSelect;
  }, [onReachHover, onReachSelect]);

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
            onReachHoverRef.current(null);
          });

          map.on("mousemove", reachLayerId(part.id), (event) => {
            onReachHoverRef.current(firstFeatureProperties(event, continent));
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

  return (
    <div className="map-wrap">
      <div className="map-container" ref={containerRef} />
      {continentTiles.length === 0 && !OVERVIEW_TILE ? (
        <div className="map-empty-state">
          <strong>Map shell ready.</strong>
          <span>Set VITE_SWORD_CONTINENTS to one or more continent IDs.</span>
        </div>
      ) : null}
    </div>
  );
}
