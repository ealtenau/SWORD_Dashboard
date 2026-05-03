import type { LineLayerSpecification } from "maplibre-gl";
import type { ColorMetadata, LayerMode } from "../types";
import { getLayerColorExpression } from "./symbology";

type LinePaint = NonNullable<LineLayerSpecification["paint"]>;

export function getReachLinePaint(layerMode: LayerMode, metadata?: ColorMetadata | null): LinePaint {
  return {
    "line-color": getLayerColorExpression(layerMode, metadata),
    "line-opacity": 0.9,
    "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 6, 2.2, 9, 4, 12, 7],
  };
}

export function getOverviewLinePaint(layerMode: LayerMode, metadata?: ColorMetadata | null): LinePaint {
  return {
    "line-color": "#2b3b90",
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.32, 3, 0.48, 5, 0.18],
    "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.35, 2, 0.7, 4, 1.25, 5, 1.7],
  };
}

export function getSelectedReachPaint(): LinePaint {
  return {
    "line-color": "#ffff00",
    "line-opacity": 1,
    "line-width": ["interpolate", ["linear"], ["zoom"], 3, 4, 7, 8, 11, 12],
  };
}
