import type { LayerMode } from "../types";
import { LAYER_CONFIGS } from "../map/symbology";

type LayerPanelProps = {
  activeLayerMode: LayerMode;
  onLayerModeChange: (mode: LayerMode) => void;
};

const LAYER_MODES: LayerMode[] = [
  "reach_id",
  "wse",
  "width",
  "facc",
  "dist_out",
  "slope",
  "n_chan_max",
  "strm_order",
  "swot_obs",
];

export function LayerPanel({ activeLayerMode, onLayerModeChange }: LayerPanelProps) {
  return (
    <div className="layer-panel">
      <h2>Layer</h2>
      <div className="segmented-control" role="radiogroup" aria-label="Reach layer mode">
        {LAYER_MODES.map((mode) => (
          <button
            aria-checked={activeLayerMode === mode}
            className={activeLayerMode === mode ? "active" : ""}
            key={mode}
            onClick={() => onLayerModeChange(mode)}
            role="radio"
            type="button"
          >
            {LAYER_CONFIGS[mode].label}
          </button>
        ))}
      </div>
    </div>
  );
}
