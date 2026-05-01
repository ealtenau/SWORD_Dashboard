import type { LineLayerSpecification } from "maplibre-gl";
import type { ColorMetadata, LayerMode } from "../types";

type LinePaint = NonNullable<LineLayerSpecification["paint"]>;

export type LayerConfig = {
  id: LayerMode;
  label: string;
  caption: string;
  colors: string[];
  stops?: number[];
  units?: string;
};

export const LAYER_CONFIGS: Record<LayerMode, LayerConfig> = {
  reach_id: {
    id: "reach_id",
    label: "Reach ID",
    caption: "Reach ID",
    colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2"],
  },
  wse: {
    id: "wse",
    label: "WSE",
    caption: "Water surface elevation",
    colors: ["#333399", "#00a6ca", "#8fd744", "#ffffbf", "#b2762c", "#ffffff"],
    stops: [0, 250, 1000, 2000, 4000],
    units: "m",
  },
  width: {
    id: "width",
    label: "Width",
    caption: "Width",
    colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    stops: [0, 50, 200, 1000],
    units: "m",
  },
  facc: {
    id: "facc",
    label: "Flow Accum.",
    caption: "Flow accumulation",
    colors: ["#5e4fa2", "#3288bd", "#66c2a5", "#ffffbf", "#f46d43", "#9e0142"],
    stops: [0, 1000, 10000, 100000],
    units: "sq.km",
  },
  dist_out: {
    id: "dist_out",
    label: "Distance",
    caption: "Distance from outlet",
    colors: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"],
    stops: [0, 100000, 1000000],
    units: "m",
  },
  slope: {
    id: "slope",
    label: "Slope",
    caption: "Slope",
    colors: ["#0b0000", "#b00000", "#ff6a00", "#ffff00", "#ffffff"],
    stops: [0, 0.0005, 0.002],
    units: "m/km",
  },
  swot_obs: {
    id: "swot_obs",
    label: "SWOT Obs.",
    caption: "SWOT observations",
    colors: ["#000000", "#2020a0", "#8d35f0", "#f06c6c", "#ffd84a", "#ffffff"],
    stops: [0, 1, 2, 4, 6, 8, 10],
  },
};

function interpolateStops(stops: number[], colorCount: number) {
  if (stops.length === colorCount) {
    return stops;
  }

  if (stops.length < 2) {
    return Array.from({ length: colorCount }, (_, index) => index);
  }

  const min = stops[0];
  const max = stops[stops.length - 1];
  const interval = (max - min) / Math.max(colorCount - 1, 1);

  return Array.from({ length: colorCount }, (_, index) => min + interval * index);
}

function getSteppedColorExpression(
  field: LayerMode,
  stops: number[],
  colors: string[],
): LinePaint["line-color"] {
  const normalizedStops = interpolateStops(stops, colors.length);
  const expression: unknown[] = ["step", ["to-number", ["get", field]], colors[0]];

  normalizedStops.slice(1).forEach((stop, index) => {
    expression.push(stop, colors[index + 1] ?? colors[colors.length - 1]);
  });

  return expression as LinePaint["line-color"];
}

export function getLayerConfig(layerMode: LayerMode, metadata?: ColorMetadata | null): LayerConfig {
  const fallback = LAYER_CONFIGS[layerMode];
  const layerMetadata = metadata?.layers[layerMode];

  if (!layerMetadata) {
    return fallback;
  }

  return {
    ...fallback,
    caption: layerMetadata.caption ?? fallback.caption,
    colors: layerMetadata.colors.length > 0 ? layerMetadata.colors : fallback.colors,
    stops: layerMetadata.stops.length > 0 ? layerMetadata.stops : fallback.stops,
    units: layerMetadata.units ?? fallback.units,
  };
}

export function getLayerColorExpression(layerMode: LayerMode, metadata?: ColorMetadata | null): LinePaint["line-color"] {
  switch (layerMode) {
    case "reach_id":
      return [
        "match",
        ["%", ["to-number", ["get", "reach_id"]], 7],
        0,
        "#1f77b4",
        1,
        "#ff7f0e",
        2,
        "#2ca02c",
        3,
        "#d62728",
        4,
        "#9467bd",
        5,
        "#8c564b",
        "#e377c2",
      ] as LinePaint["line-color"];
    case "swot_obs":
      if (metadata?.layers.swot_obs) {
        const config = getLayerConfig("swot_obs", metadata);
        const expression: unknown[] = ["step", ["to-number", ["get", "swot_obs"]], config.colors[0]];
        (config.stops ?? []).slice(1).forEach((stop, index) => {
          expression.push(stop, config.colors[index + 1] ?? config.colors[config.colors.length - 1]);
        });
        return expression as LinePaint["line-color"];
      }

      return [
        "step",
        ["to-number", ["get", "swot_obs"]],
        "#000000",
        1,
        "#2020a0",
        2,
        "#8d35f0",
        4,
        "#f06c6c",
        6,
        "#ffd84a",
        8,
        "#ffffff",
      ] as LinePaint["line-color"];
    default: {
      const config = getLayerConfig(layerMode, metadata);
      const colors = config.colors;
      const stops = interpolateStops(config.stops ?? [], colors.length);

      if (metadata?.layers[layerMode]?.classification === "quantile") {
        return getSteppedColorExpression(layerMode, stops, colors);
      }

      const expression: unknown[] = ["interpolate", ["linear"], ["to-number", ["get", layerMode]]];

      colors.forEach((color, index) => {
        expression.push(stops[index], color);
      });

      return expression as LinePaint["line-color"];
    }
  }
}
