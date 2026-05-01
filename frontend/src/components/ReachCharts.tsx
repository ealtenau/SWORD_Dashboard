type ReachChartsProps = {
  selectedReachId: string | null;
};

const CHARTS = ["Water surface elevation", "Width", "Node order", "Flow accumulation", "Channels", "Sinuosity"];

export function ReachCharts({ selectedReachId }: ReachChartsProps) {
  return (
    <section className="panel-section charts-section">
      <div className="panel-heading">
        <p className="eyebrow">Node Attributes</p>
        <h2>{selectedReachId ? `Reach ${selectedReachId}` : "Select a reach"}</h2>
      </div>

      <div className="chart-grid">
        {CHARTS.map((chart) => (
          <div className="chart-placeholder" key={chart}>
            <span>{chart}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
