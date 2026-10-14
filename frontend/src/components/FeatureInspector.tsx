import { formatReachNumber } from "../data/formatNumbers";
import { mainstemLabel } from "../data/reachClassification";
import type { ReachProperties } from "../types";

type FeatureInspectorProps = {
  hoveredReach: ReachProperties | null;
  selectedReach: ReachProperties | null;
  onClearSelection: () => void;
};

const ATTRIBUTE_ROWS: Array<{ key: string; label: string }> = [
  { key: "reach_id", label: "Reach ID" },
  { key: "river_name", label: "River" },
  { key: "wse", label: "WSE" },
  { key: "wse_obs_p50", label: "SWOT Median WSE" },
  { key: "width", label: "Width" },
  { key: "width_obs_p50", label: "SWOT Median Width" },
  { key: "facc_total", label: "Flow accumulation" },
  { key: "dist_out", label: "Distance out" },
  { key: "slope", label: "Slope" },
  { key: "slope_obs_p50", label: "SWOT Median Slope (m/km)" },
  { key: "is_mainstem", label: "Channel type" },
  { key: "swot_obs", label: "SWOT observations" },
];

function formatValue(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "Not available";
    return field === "reach_id" ? String(value) : formatReachNumber(value, field);
  }

  return String(value);
}

export function FeatureInspector({ hoveredReach, selectedReach, onClearSelection }: FeatureInspectorProps) {
  const reach = selectedReach ?? hoveredReach;

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <p className="eyebrow">Feature Inspector</p>
        <h2>{selectedReach ? "Selected reach" : hoveredReach ? "Hovered reach" : "No reach selected"}</h2>
        {selectedReach ? (
          <button className="clear-selection-button" onClick={onClearSelection} type="button">
            Clear selection
          </button>
        ) : null}
      </div>

      {reach ? (
        <dl className="attribute-list">
          {ATTRIBUTE_ROWS.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.key === "is_mainstem" ? mainstemLabel(reach[row.key]) : formatValue(reach[row.key], row.key)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty-state">Hover or click a reach once a SWORD vector tile source is connected.</p>
      )}
    </section>
  );
}
