import { formatOneDecimal } from "../data/formatNumbers";
import { getLayerConfig } from "../map/symbology";
import type { ColorMetadata, LayerMode } from "../types";

type MapLegendProps = {
  activeLayerMode: LayerMode;
  colorMetadata: ColorMetadata | null;
  scopeLabel?: string;
};

export function MapLegend({ activeLayerMode, colorMetadata, scopeLabel }: MapLegendProps) {
  const activeConfig = getLayerConfig(activeLayerMode, colorMetadata);
  const gradient = `linear-gradient(90deg, ${activeConfig.colors.join(", ")})`;
  const formatCategory = (label: string) => label.replace(/\d+(?:\.\d+)?/g, (value) => formatOneDecimal(Number(value)));

  return (
    <div className="map-legend">
      <div className="legend-title">
        <span>{activeConfig.caption}</span>
        {activeConfig.units ? <span>{activeConfig.units}</span> : null}
      </div>
      {scopeLabel ? <div className="legend-meta">{scopeLabel}</div> : null}
      {colorMetadata?.layers[activeLayerMode]?.classification ? (
        <div className="legend-meta">{colorMetadata.layers[activeLayerMode]?.classification}</div>
      ) : null}
      {activeConfig.categories ? (
        <div className="legend-categories">
          {activeConfig.categories.map((label, index) => (
            <div className="legend-no-data" key={label}>
              <span style={{ backgroundColor: activeConfig.colors[index] }} />{formatCategory(label)}
            </div>
          ))}
        </div>
      ) : <div className="legend-ramp" style={{ background: gradient }} />}
      {activeConfig.categories ? null : activeConfig.stops ? (
        <div className="legend-stops">
          <span>{formatOneDecimal(activeConfig.stops[0])}</span>
          <span>{formatOneDecimal(activeConfig.stops[activeConfig.stops.length - 1])}</span>
        </div>
      ) : (
        <div className="legend-stops">
          <span>categorical</span>
          <span>by reach</span>
        </div>
      )}
      {activeConfig.noDataColor ? (
        <div className="legend-no-data">
          <span style={{ backgroundColor: activeConfig.noDataColor }} />No data
        </div>
      ) : null}
    </div>
  );
}
