import { getLayerConfig } from "../map/symbology";
import type { ColorMetadata, LayerMode } from "../types";

type MapLegendProps = {
  activeLayerMode: LayerMode;
  colorMetadata: ColorMetadata | null;
};

export function MapLegend({ activeLayerMode, colorMetadata }: MapLegendProps) {
  const activeConfig = getLayerConfig(activeLayerMode, colorMetadata);
  const gradient = `linear-gradient(90deg, ${activeConfig.colors.join(", ")})`;

  return (
    <div className="map-legend">
      <div className="legend-title">
        <span>{activeConfig.caption}</span>
        {activeConfig.units ? <span>{activeConfig.units}</span> : null}
      </div>
      {colorMetadata?.layers[activeLayerMode]?.classification ? (
        <div className="legend-meta">{colorMetadata.layers[activeLayerMode]?.classification}</div>
      ) : null}
      <div className="legend-ramp" style={{ background: gradient }} />
      {activeConfig.stops ? (
        <div className="legend-stops">
          <span>{activeConfig.stops[0]}</span>
          <span>{activeConfig.stops[activeConfig.stops.length - 1]}</span>
        </div>
      ) : (
        <div className="legend-stops">
          <span>categorical</span>
          <span>by reach</span>
        </div>
      )}
    </div>
  );
}
