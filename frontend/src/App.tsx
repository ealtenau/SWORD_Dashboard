import { useEffect, useMemo, useState } from "react";
import { FeatureInspector } from "./components/FeatureInspector";
import { InfoModal } from "./components/InfoModal";
import { LayerPanel } from "./components/LayerPanel";
import { MapLegend } from "./components/MapLegend";
import { MapView } from "./components/MapView";
import { ReachCharts } from "./components/ReachCharts";
import { ReachSearch } from "./components/ReachSearch";
import { loadColorMetadataByContinent } from "./data/colorMetadata";
import { loadContinentTileManifest, type ContinentTileConfig } from "./data/continents";
import { loadReachSearchIndex, selectionRecords, type ReachSearchResult } from "./data/reachSearch";
import type { ColorMetadataByContinent, LayerMode, ReachProperties, ReachSearchRecord, ReachSearchSelection } from "./types";
import aboutContent from "../../about.md?raw";
import downloadContent from "../../download.md?raw";
import swordLogo from "../../assets/SWORD_Logo.png";
import swotLogo from "../../assets/swot_mainlogo_dark2.png";

type ActiveModal = "about" | "download" | null;

export function App() {
  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("reach_id");
  const [colorMetadataByContinent, setColorMetadataByContinent] = useState<ColorMetadataByContinent>({});
  const [continentTiles, setContinentTiles] = useState<ContinentTileConfig[] | null>(null);
  const [selectedReach, setSelectedReach] = useState<ReachProperties | null>(null);
  const [hoveredReach, setHoveredReach] = useState<ReachProperties | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [searchRecords, setSearchRecords] = useState<ReachSearchRecord[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const [searchSelection, setSearchSelection] = useState<ReachSearchSelection | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    loadReachSearchIndex()
      .then((records) => {
        if (isMounted) {
          setSearchRecords(records);
        }
      })
      .catch((error) => {
        console.warn(error);
      })
      .finally(() => {
        if (isMounted) {
          setIsSearchLoading(false);
        }
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

  const legendContinentId =
    selectedReach?._continent_id ??
    hoveredReach?._continent_id ??
    (continentTiles?.length === 1 ? continentTiles[0].id : undefined);
  const legendColorMetadata = legendContinentId ? colorMetadataByContinent[legendContinentId] ?? null : null;
  const legendScope =
    selectedReach?._continent_name ??
    hoveredReach?._continent_name ??
    (continentTiles?.length === 1 ? continentTiles[0].name : "Local continent scales");

  const handleSearchSelect = (result: ReachSearchResult) => {
    const records = selectionRecords(result);
    setSearchSelection({
      bbox: result.bbox,
      records,
      type: result.type,
    });

    if (result.type === "reach") {
      setSelectedReach({
        reach_id: result.record.reach_id,
        river_name: result.record.river_name,
        _continent_id: result.record.continent_id,
      });
    } else {
      setSelectedReach(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logos" aria-hidden="true">
            <img src={swotLogo} alt="" />
            <img src={swordLogo} alt="" />
          </div>
          <div>
            <p className="eyebrow">SWORD Explorer</p>
            <h1>SWOT River Database - Version 17b</h1>
          </div>
        </div>
        <div className="header-actions" aria-label="SWORD information">
          <button onClick={() => setActiveModal("about")} type="button">
            About
          </button>
          <button onClick={() => setActiveModal("download")} type="button">
            Download
          </button>
        </div>
      </header>
      <InfoModal
        content={aboutContent}
        isOpen={activeModal === "about"}
        onClose={() => setActiveModal(null)}
        title="About SWORD"
      />
      <InfoModal
        content={downloadContent}
        isOpen={activeModal === "download"}
        onClose={() => setActiveModal(null)}
        title="Download SWORD"
      />

      <main className="workspace">
        <section className="map-region" aria-label="Interactive SWORD map">
          {continentTiles ? (
            <MapView
              activeLayerMode={activeLayerMode}
              colorMetadataByContinent={colorMetadataByContinent}
              continentTiles={continentTiles}
              searchSelection={searchSelection}
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
          <ReachSearch
            isLoading={isSearchLoading}
            onSelect={handleSearchSelect}
            records={searchRecords}
          />
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
