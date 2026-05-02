import { useEffect, useMemo, useState } from "react";
import { FeatureInspector } from "./components/FeatureInspector";
import { LayerPanel } from "./components/LayerPanel";
import { MapLegend } from "./components/MapLegend";
import { MapView } from "./components/MapView";
import { ReachCharts } from "./components/ReachCharts";
import { loadColorMetadataByContinent } from "./data/colorMetadata";
import { loadContinentTileManifest, type ContinentTileConfig } from "./data/continents";
import type { ColorMetadataByContinent, LayerMode, ReachProperties } from "./types";

export function App() {
  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("reach_id");
  const [colorMetadataByContinent, setColorMetadataByContinent] = useState<ColorMetadataByContinent>({});
  const [continentTiles, setContinentTiles] = useState<ContinentTileConfig[] | null>(null);
  const [selectedReach, setSelectedReach] = useState<ReachProperties | null>(null);
  const [hoveredReach, setHoveredReach] = useState<ReachProperties | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadContinentTileManifest()
      .then((tiles) => {
        if (isMounted) {
          setContinentTiles(tiles);
        }
      })
      .catch((error) => {
        console.warn(error);
        if (isMounted) {
          setContinentTiles([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!continentTiles) {
      return;
    }

    let isMounted = true;

    loadColorMetadataByContinent(continentTiles)
      .then((metadata) => {
        if (isMounted) {
          setColorMetadataByContinent(metadata);
        }
      })
      .catch((error) => {
        console.warn(error);
      });

    return () => {
      isMounted = false;
    };
  }, [continentTiles]);

  const selectedReachId = useMemo(() => {
    if (!selectedReach?.reach_id) {
      return null;
    }

    return String(selectedReach.reach_id);
  }, [selectedReach]);

  const legendContinentId =
    selectedReach?._continent_id ??
    hoveredReach?._continent_id ??
    (continentTiles?.length === 1 ? continentTiles[0].id : undefined);
  const legendColorMetadata = legendContinentId ? colorMetadataByContinent[legendContinentId] ?? null : null;
  const legendScope =
    selectedReach?._continent_name ??
    hoveredReach?._continent_name ??
    (continentTiles?.length === 1 ? continentTiles[0].name : "Local continent scales");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SWORD Explorer</p>
          <h1>SWOT River Database</h1>
        </div>
        <div className="header-status">
          <span>React + MapLibre prototype</span>
        </div>
      </header>

      <main className="workspace">
        <section className="map-region" aria-label="Interactive SWORD map">
          {continentTiles ? (
            <MapView
              activeLayerMode={activeLayerMode}
              colorMetadataByContinent={colorMetadataByContinent}
              continentTiles={continentTiles}
              selectedReachId={selectedReachId}
              onReachHover={setHoveredReach}
              onReachSelect={setSelectedReach}
            />
          ) : (
            <div className="map-wrap">
              <div className="map-empty-state">
                <strong>Loading map assets.</strong>
                <span>Preparing the SWORD tile manifest.</span>
              </div>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="Reach details">
          <LayerPanel
            activeLayerMode={activeLayerMode}
            onLayerModeChange={setActiveLayerMode}
          />
          <MapLegend
            activeLayerMode={activeLayerMode}
            colorMetadata={legendColorMetadata}
            scopeLabel={legendScope}
          />
          <FeatureInspector hoveredReach={hoveredReach} selectedReach={selectedReach} />
          <ReachCharts selectedReachId={selectedReachId} />
        </aside>
      </main>
    </div>
  );
}
