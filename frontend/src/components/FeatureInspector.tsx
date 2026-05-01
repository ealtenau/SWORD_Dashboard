import type { ReachProperties } from "../types";

type FeatureInspectorProps = {
  hoveredReach: ReachProperties | null;
  selectedReach: ReachProperties | null;
};

const ATTRIBUTE_ROWS: Array<{ key: keyof ReachProperties; label: string }> = [
  { key: "reach_id", label: "Reach ID" },
  { key: "river_name", label: "River" },
  { key: "wse", label: "WSE" },
  { key: "width", label: "Width" },
  { key: "facc", label: "Flow accumulation" },
  { key: "dist_out", label: "Distance out" },
  { key: "slope", label: "Slope" },
  { key: "swot_obs", label: "SWOT observations" },
];

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  return String(value);
}

export function FeatureInspector({ hoveredReach, selectedReach }: FeatureInspectorProps) {
  const reach = selectedReach ?? hoveredReach;

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <p className="eyebrow">Feature Inspector</p>
        <h2>{selectedReach ? "Selected reach" : hoveredReach ? "Hovered reach" : "No reach selected"}</h2>
      </div>

      {reach ? (
        <dl className="attribute-list">
          {ATTRIBUTE_ROWS.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{formatValue(reach[row.key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty-state">Hover or click a reach once a SWORD vector tile source is connected.</p>
      )}
    </section>
  );
}
