import { PointerEvent, useEffect, useMemo, useState } from "react";
import { loadNodeProfile } from "../data/nodeProfiles";
import type { NodeProfile, NodeRecord } from "../types";

type ReachChartsProps = {
  selectedReachId: string | null;
};

type ChartConfig = {
  key: keyof NodeRecord;
  label: string;
  units?: string;
};

const CHARTS: ChartConfig[] = [
  { key: "wse", label: "Water surface elevation", units: "m" },
  { key: "width", label: "Width", units: "m" },
  { key: "node_order", label: "Node order" },
  { key: "facc", label: "Flow accumulation", units: "sq.km" },
  { key: "n_chan_mod", label: "Channels" },
  { key: "sinuosity", label: "Sinuosity" },
];

type ZoomDomain = {
  xMin: number;
  xMax: number;
} | null;

type HoveredPoint = {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
} | null;

function finiteValues(profile: NodeProfile, key: keyof NodeRecord) {
  return profile.nodes
    .map((node) => ({
      x: node.dist_out === null ? null : node.dist_out / 1000,
      y: typeof node[key] === "number" ? node[key] : null,
    }))
    .filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null);
}

function extent(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - 1, max + 1];
  }

  const padding = (max - min) * 0.08;
  return [min - padding, max + padding];
}

function ticks(min: number, max: number, count = 3) {
  if (count < 2) {
    return [min];
  }

  const interval = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + interval * index);
}

function formatTick(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  if (absolute >= 10) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function MiniLineChart({ config, profile }: { config: ChartConfig; profile: NodeProfile }) {
  const points = useMemo(() => finiteValues(profile, config.key), [config.key, profile]);
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint>(null);

  if (points.length < 2) {
    return (
      <div className="chart-placeholder">
        <span>{config.label}</span>
      </div>
    );
  }

  const width = 300;
  const height = 152;
  const pad = { top: 12, right: 14, bottom: 42, left: 56 };
  const [fullXMin, fullXMax] = extent(points.map((point) => point.x));
  const xMin = zoomDomain?.xMin ?? fullXMin;
  const xMax = zoomDomain?.xMax ?? fullXMax;
  const visiblePoints = points.filter((point) => point.x >= xMin && point.x <= xMax);
  const displayedPoints = visiblePoints.length >= 2 ? visiblePoints : points;
  const [yMin, yMax] = extent(displayedPoints.map((point) => point.y));
  const xTicks = ticks(xMin, xMax, 3);
  const yTicks = ticks(yMin, yMax, 3);

  const xScale = (value: number) => pad.left + ((value - xMin) / (xMax - xMin)) * (width - pad.left - pad.right);
  const yScale = (value: number) => height - pad.bottom - ((value - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  const path = displayedPoints.map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.x)},${yScale(point.y)}`).join(" ");
  const plotLeft = pad.left;
  const plotRight = width - pad.right;
  const plotTop = pad.top;
  const plotBottom = height - pad.bottom;
  const selectionStart = dragStart === null || dragEnd === null ? null : Math.min(dragStart, dragEnd);
  const selectionWidth = dragStart === null || dragEnd === null ? 0 : Math.abs(dragEnd - dragStart);

  const clampPlotX = (value: number) => Math.max(plotLeft, Math.min(plotRight, value));
  const pointerX = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampPlotX(((event.clientX - rect.left) / rect.width) * width);
  };
  const xFromPixel = (value: number) => xMin + ((value - plotLeft) / (plotRight - plotLeft)) * (xMax - xMin);
  const resetZoom = () => {
    setZoomDomain(null);
    setDragStart(null);
    setDragEnd(null);
  };
  const updateHoveredPoint = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart !== null) {
      return;
    }

    const x = pointerX(event);
    const dataX = xFromPixel(x);
    const nearest = displayedPoints.reduce((best, point) => {
      return Math.abs(point.x - dataX) < Math.abs(best.x - dataX) ? point : best;
    }, displayedPoints[0]);

    setHoveredPoint({
      x: nearest.x,
      y: nearest.y,
      screenX: xScale(nearest.x),
      screenY: yScale(nearest.y),
    });
  };
  const tooltipWidth = 112;
  const tooltipHeight = 34;
  const tooltipX = hoveredPoint ? Math.min(Math.max(hoveredPoint.screenX + 8, plotLeft), width - tooltipWidth - 4) : 0;
  const tooltipY = hoveredPoint ? Math.max(hoveredPoint.screenY - tooltipHeight - 8, plotTop) : 0;

  return (
    <div className="node-chart">
      <div className="node-chart-title">
        <span>{config.label}</span>
        {config.units ? <span>{config.units}</span> : null}
      </div>
      {zoomDomain ? (
        <button className="chart-reset" onClick={resetZoom} type="button">
          Reset zoom
        </button>
      ) : null}
      <svg
        onDoubleClick={resetZoom}
        onPointerDown={(event) => {
          const x = pointerX(event);
          setDragStart(x);
          setDragEnd(x);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStart !== null) {
            setDragEnd(pointerX(event));
            return;
          }

          updateHoveredPoint(event);
        }}
        onPointerLeave={() => {
          setHoveredPoint(null);
          setDragStart(null);
          setDragEnd(null);
        }}
        onPointerUp={(event) => {
          if (dragStart === null) {
            return;
          }

          const end = pointerX(event);
          if (Math.abs(end - dragStart) > 8) {
            const nextXMin = xFromPixel(Math.min(dragStart, end));
            const nextXMax = xFromPixel(Math.max(dragStart, end));
            setZoomDomain({ xMin: nextXMin, xMax: nextXMax });
          }

          setDragStart(null);
          setDragEnd(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={config.label}
      >
        <line className="chart-axis" x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} />
        <line className="chart-axis" x1={plotLeft} x2={plotLeft} y1={plotTop} y2={plotBottom} />
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="chart-grid-line" x1={plotLeft} x2={plotRight} y1={yScale(tick)} y2={yScale(tick)} />
            <line className="chart-tick-mark" x1={plotLeft - 4} x2={plotLeft} y1={yScale(tick)} y2={yScale(tick)} />
            <text className="chart-tick chart-y-tick" x={plotLeft - 7} y={yScale(tick) + 3}>
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="chart-tick-mark" x1={xScale(tick)} x2={xScale(tick)} y1={plotBottom} y2={plotBottom + 4} />
            <text className="chart-tick chart-x-tick" x={xScale(tick)} y={plotBottom + 16}>
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {selectionStart !== null && selectionWidth > 0 ? (
          <rect className="chart-selection" x={selectionStart} y={plotTop} width={selectionWidth} height={plotBottom - plotTop} />
        ) : null}
        <path className="chart-line" d={path} />
        {displayedPoints.map((point) => (
          <circle className="chart-point" cx={xScale(point.x)} cy={yScale(point.y)} key={`${point.x}-${point.y}`} r="2" />
        ))}
        {hoveredPoint ? (
          <g className="chart-tooltip">
            <line className="chart-hover-line" x1={hoveredPoint.screenX} x2={hoveredPoint.screenX} y1={plotTop} y2={plotBottom} />
            <circle className="chart-hover-point" cx={hoveredPoint.screenX} cy={hoveredPoint.screenY} r="4" />
            <rect className="chart-tooltip-box" x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="5" />
            <text className="chart-tooltip-text" x={tooltipX + 7} y={tooltipY + 14}>
              {formatTick(hoveredPoint.y)}
              {config.units ? ` ${config.units}` : ""}
            </text>
            <text className="chart-tooltip-text muted" x={tooltipX + 7} y={tooltipY + 27}>
              {formatTick(hoveredPoint.x)} km
            </text>
          </g>
        ) : null}
        <text className="chart-axis-label chart-x-label" x={pad.left + (width - pad.left - pad.right) / 2} y={height - 6}>
          Distance from outlet (km)
        </text>
      </svg>
    </div>
  );
}

export function ReachCharts({ selectedReachId }: ReachChartsProps) {
  const [profile, setProfile] = useState<NodeProfile | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!selectedReachId) {
      setProfile(null);
      setStatus("idle");
      return;
    }

    let isMounted = true;
    setStatus("loading");

    loadNodeProfile(selectedReachId)
      .then((nodeProfile) => {
        if (isMounted) {
          setProfile(nodeProfile);
          setStatus("idle");
        }
      })
      .catch((error) => {
        console.warn(error);
        if (isMounted) {
          setProfile(null);
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedReachId]);

  return (
    <section className="panel-section charts-section">
      <div className="panel-heading">
        <p className="eyebrow">Node Attributes</p>
        <h2>{selectedReachId ? `Reach ${selectedReachId}` : "Select a reach"}</h2>
      </div>

      {!selectedReachId ? <p className="empty-state">Click a reach to load node-level profiles.</p> : null}
      {status === "loading" ? <p className="empty-state">Loading node profile...</p> : null}
      {status === "error" ? <p className="empty-state">No node profile found for this reach yet.</p> : null}
      {profile ? (
        <div className="chart-grid">
          {CHARTS.map((chart) => (
            <MiniLineChart config={chart} key={chart.key} profile={profile} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
