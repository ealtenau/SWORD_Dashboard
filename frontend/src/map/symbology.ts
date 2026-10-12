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
  noDataColor?: string;
  categories?: string[];
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
  wse_obs_p50: {
    id: "wse_obs_p50",
    label: "SWOT Median WSE",
    caption: "SWOT Median WSE",
    colors: ["#333399", "#00a6ca", "#8fd744", "#ffffbf", "#b2762c", "#ffffff"],
    stops: [0, 250, 1000, 2000, 4000],
    units: "m",
    noDataColor: "#ffffff",
  },
  width: {
    id: "width",
    label: "Width",
    caption: "Width",
    colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    stops: [0, 50, 200, 1000],
    units: "m",
  },
  width_obs_p50: {
    id: "width_obs_p50",
    label: "SWOT Median Width",
    caption: "SWOT Median Width",
    colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    stops: [0, 50, 200, 1000],
    units: "m",
    noDataColor: "#ffffff",
  },
  facc_total: {
    id: "facc_total",
    label: "Flow Accum.",
    caption: "Flow accumulation",
    colors: ["#3b0f70", "#3f60d5", "#13a7e8", "#12d9a3", "#00e51a", "#a8f000", "#ffb000", "#ff5a00", "#d90000"],
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
    colors: ["#451025", "#8c2736", "#c65327", "#e58a19", "#f2bd32"],
    stops: [0, 0.0005, 0.002],
    units: "m/km",
  },
  slope_obs_p50: {
    id: "slope_obs_p50",
    label: "SWOT Median Slope",
    caption: "SWOT Median Slope",
    colors: ["#451025", "#8c2736", "#c65327", "#e58a19", "#f2bd32"],
    stops: [0, 0.0005, 0.002],
    units: "m/km",
    noDataColor: "#ffffff",
  },
  n_chan_max: {
    id: "n_chan_max",
    label: "Channels",
    caption: "Number of channels",
    colors: ["#4b2286", "#71449d", "#c343ad", "#e55c9b", "#f07865"],
    stops: [1, 2, 4, 6, 8, 36],
    categories: ["1", "2–3", "4–5", "6–7", "8+"],
  },
  is_mainstem: {
    id: "is_mainstem",
    label: "Mainstem / Side channel",
    caption: "Mainstem / Side channel",
    colors: ["#2b3b90", "#d90000"],
    categories: ["Mainstem", "Side channel"],
    noDataColor: "#ffffff",
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

function darkenPaleColor(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const brightness = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  // Gradually darken highlights by up to 20%, rather than flattening them to a cap.
  // The resulting brightness remains ordered, preserving differences between bins.
  if (brightness <= 0.65) return color;
  const scale = 1 - 0.2 * (brightness - 0.65) / 0.35;
  return `#${channels.map((channel) => Math.round(channel * scale).toString(16).padStart(2, "0")).join("")}`;
}

// Resample the display palette to preserve the existing number of quantile bins.
function samplePalette(colors: string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const position = count <= 1 ? 0 : index * (colors.length - 1) / (count - 1);
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, colors.length - 1);
    const fraction = position - lower;
    const channels = [1, 3, 5].map((offset) => {
      const start = parseInt(colors[lower].slice(offset, offset + 2), 16);
      const end = parseInt(colors[upper].slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * fraction).toString(16).padStart(2, "0");
    });
    return `#${channels.join("")}`;
  });
}

export function getLayerConfig(layerMode: LayerMode, metadata?: ColorMetadata | null): LayerConfig {
  const fallback = LAYER_CONFIGS[layerMode];
  const layerMetadata = metadata?.layers[layerMode];
  let config = layerMetadata ? {
    ...fallback,
    caption: layerMetadata.caption ?? fallback.caption,
    colors: layerMetadata.colors.length > 0 ? layerMetadata.colors : fallback.colors,
    stops: layerMetadata.stops.length > 0 ? layerMetadata.stops : fallback.stops,
    units: layerMetadata.units ?? fallback.units,
  } : fallback;

  if (layerMode === "n_chan_max") {
    return { ...config, colors: fallback.colors };
  }

  if (["slope", "slope_obs_p50"].includes(layerMode)) {
    config = { ...config, colors: samplePalette(fallback.colors, config.colors.length) };
  }

  if (["wse", "wse_obs_p50"].includes(layerMode)) {
    return { ...config, colors: config.colors.map(darkenPaleColor) };
  }
  return config;
}

function getValidLayerColorExpression(layerMode: LayerMode, metadata?: ColorMetadata | null): LinePaint["line-color"] {
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
    case "n_chan_max": {
      const config = getLayerConfig("n_chan_max", metadata);
      return [
        "step",
        ["to-number", ["get", "n_chan_max"]],
        config.colors[0],
        2,
        config.colors[1],
        4,
        config.colors[2],
        6,
        config.colors[3],
        8,
        config.colors[4],
      ] as LinePaint["line-color"];
    }
    case "is_mainstem": {
      const config = getLayerConfig("is_mainstem", metadata);
      return ["match", ["to-string", ["get", "is_mainstem"]],
        ["true", "1"], config.colors[0],
        ["false", "0"], config.colors[1],
        config.noDataColor ?? "#ffffff",
      ] as LinePaint["line-color"];
    }
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

export function getLayerColorExpression(layerMode: LayerMode, metadata?: ColorMetadata | null): LinePaint["line-color"] {
  const expression = getValidLayerColorExpression(layerMode, metadata);
  const noDataColor = LAYER_CONFIGS[layerMode].noDataColor;
  if (!noDataColor) return expression;

  return ["case", ["==", ["get", layerMode], null], noDataColor, expression] as LinePaint["line-color"];
}
