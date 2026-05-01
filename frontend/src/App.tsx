import { useEffect, useMemo, useState } from "react";
import { FeatureInspector } from "./components/FeatureInspector";
import { LayerPanel } from "./components/LayerPanel";
import { MapLegend } from "./components/MapLegend";
import { MapView } from "./components/MapView";
import { ReachCharts } from "./components/ReachCharts";
import { loadColorMetadata } from "./data/colorMetadata";
import type { ColorMetadata, LayerMode, ReachProperties } from "./types";

export function App() {
  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("reach_id");
  const [colorMetadata, setColorMetadata] = useState<ColorMetadata | null>(null);
  const [selectedReach, setSelectedReach] = useState<ReachProperties | null>(null);
  const [hoveredReach, setHoveredReach] = useState<ReachProperties | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadColorMetadata()
      .then((metadata) => {
        if (isMounted) {
          setColorMetadata(metadata);
        }
      })
      .catch((error) => {
        console.warn(error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedReachId = useMemo(() => {
    if (!selectedReach?.reach_id) {
      return null;
    }

    return String(selectedReach.reach_id);
  }, [selectedReach]);

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
          <MapView
            activeLayerMode={activeLayerMode}
            colorMetadata={colorMetadata}
            selectedReachId={selectedReachId}
            onReachHover={setHoveredReach}
            onReachSelect={setSelectedReach}
          />
          <div className="map-control-stack">
            <LayerPanel
              activeLayerMode={activeLayerMode}
              onLayerModeChange={setActiveLayerMode}
            />
            <MapLegend activeLayerMode={activeLayerMode} colorMetadata={colorMetadata} />
          </div>
        </section>

        <aside className="side-panel" aria-label="Reach details">
          <FeatureInspector hoveredReach={hoveredReach} selectedReach={selectedReach} />
          <ReachCharts selectedReachId={selectedReachId} />
        </aside>
      </main>
    </div>
  );
}
