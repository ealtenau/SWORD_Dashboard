import { useEffect, useRef } from "react";
import maplibregl, { MapLayerMouseEvent } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { getReachLinePaint, getSelectedReachPaint } from "../map/layers";
import { BASE_STYLE, REACH_LAYER_ID, REACH_SOURCE_ID } from "../map/styles";
import type { ColorMetadata, LayerMode, ReachProperties } from "../types";

type MapViewProps = {
  activeLayerMode: LayerMode;
  colorMetadata: ColorMetadata | null;
  selectedReachId: string | null;
  onReachHover: (properties: ReachProperties | null) => void;
  onReachSelect: (properties: ReachProperties) => void;
};

const reachesPmtilesUrl = import.meta.env.VITE_SWORD_REACHES_PMTILES;
const reachesSourceLayer = import.meta.env.VITE_SWORD_REACHES_SOURCE_LAYER ?? "reaches";
const initialCenter: [number, number] = [
  Number(import.meta.env.VITE_MAP_CENTER_LON ?? 135),
  Number(import.meta.env.VITE_MAP_CENTER_LAT ?? -20),
];
const initialZoom = Number(import.meta.env.VITE_MAP_ZOOM ?? 3);

function normalizePmtilesUrl(url: string) {
  return url.startsWith("pmtiles://") ? url : `pmtiles://${url}`;
}

function firstFeatureProperties(event: MapLayerMouseEvent): ReachProperties | null {
  const feature = event.features?.[0];
  if (!feature?.properties) {
    return null;
  }

  return feature.properties as ReachProperties;
}

export function MapView({ activeLayerMode, colorMetadata, selectedReachId, onReachHover, onReachSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
      if (!reachesPmtilesUrl) {
        return;
      }

      map.addSource(REACH_SOURCE_ID, {
        type: "vector",
        url: normalizePmtilesUrl(reachesPmtilesUrl),
      });

      map.addLayer({
        id: REACH_LAYER_ID,
        type: "line",
        source: REACH_SOURCE_ID,
        "source-layer": reachesSourceLayer,
        paint: getReachLinePaint(activeLayerMode, colorMetadata),
      });

      map.addLayer({
        id: "sword-reaches-selected",
        type: "line",
        source: REACH_SOURCE_ID,
        "source-layer": reachesSourceLayer,
        filter: ["==", ["to-string", ["get", "reach_id"]], ""],
        paint: getSelectedReachPaint(),
      });

      map.on("mouseenter", REACH_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", REACH_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        onReachHover(null);
      });

      map.on("mousemove", REACH_LAYER_ID, (event) => {
        onReachHover(firstFeatureProperties(event));
      });

      map.on("click", REACH_LAYER_ID, (event) => {
        const properties = firstFeatureProperties(event);
        if (properties) {
          onReachSelect(properties);
        }
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
    if (!map?.getLayer(REACH_LAYER_ID)) {
      return;
    }

    const paint = getReachLinePaint(activeLayerMode, colorMetadata);
    Object.entries(paint ?? {}).forEach(([property, value]) => {
      map.setPaintProperty(REACH_LAYER_ID, property, value);
    });
  }, [activeLayerMode, colorMetadata]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("sword-reaches-selected")) {
      return;
    }

    map.setFilter("sword-reaches-selected", ["==", ["to-string", ["get", "reach_id"]], selectedReachId ?? ""]);
  }, [selectedReachId]);

  return (
    <div className="map-wrap">
      <div className="map-container" ref={containerRef} />
      {!reachesPmtilesUrl ? (
        <div className="map-empty-state">
          <strong>Map shell ready.</strong>
          <span>Set VITE_SWORD_REACHES_PMTILES to render SWORD reach tiles.</span>
        </div>
      ) : null}
    </div>
  );
}
