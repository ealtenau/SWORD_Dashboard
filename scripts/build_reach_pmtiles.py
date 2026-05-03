#!/usr/bin/env python3
"""Build a PMTiles archive for one SWORD reach file.

This script expects Tippecanoe to be installed and available on PATH. It uses
GeoPandas to normalize SWORD reach attributes, writes temporary GeoJSONL, then
hands that to Tippecanoe for vector tile generation.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import numpy as np
from matplotlib import colormaps as cm
from matplotlib.colors import rgb2hex


DEFAULT_PROPERTIES = (
    "reach_id",
    "river_name",
    "wse",
    "width",
    "facc",
    "dist_out",
    "slope",
    "swot_obs",
    "swot_orbit",
    "n_chan_max",
    "strm_order",
    "rch_id_up",
    "rch_id_dn",
    "x",
    "y",
)

COLOR_LAYER_CONFIG = {
    "wse": {
        "caption": "Water surface elevation",
        "units": "m",
        "cmap": "terrain",
    },
    "width": {
        "caption": "Width",
        "units": "m",
        "cmap": "viridis",
    },
    "facc": {
        "caption": "Flow accumulation",
        "units": "sq.km",
        "cmap": "Spectral",
        "reverse": True,
    },
    "dist_out": {
        "caption": "Distance from outlet",
        "units": "m",
        "cmap": "plasma",
    },
    "slope": {
        "caption": "Slope",
        "units": "m/km",
        "cmap": "hot",
    },
}

SWOT_OBS_STOPS = [0, 1, 2, 4, 6, 8, 10]
N_CHAN_MAX_STOPS = [1, 2, 4, 6, 8, 36]
N_CHAN_MAX_COLORS = ["#ffffcc", "#a1dab4", "#00bfc4", "#0570b0", "#253494"]
STRM_ORDER_STOPS = [-9999, 1, 2, 3, 4, 5, 6, 7, 8]
STRM_ORDER_COLORS = [
    "#3b0f70",
    "#3f60d5",
    "#13a7e8",
    "#12d9a3",
    "#00e51a",
    "#a8f000",
    "#ffb000",
    "#ff5a00",
    "#d90000",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a one-basin SWORD reach PMTiles archive.",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input SWORD reach vector file, such as a .shp, .gpkg, .fgb, or .geojson.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        required=True,
        help="Output .pmtiles path.",
    )
    parser.add_argument(
        "--layer",
        default="reaches",
        help="Vector tile source-layer name. Default: reaches.",
    )
    parser.add_argument(
        "--minzoom",
        type=int,
        default=3,
        help="Minimum tile zoom. Default: 3.",
    )
    parser.add_argument(
        "--maxzoom",
        type=int,
        default=14,
        help="Maximum tile zoom. Default: 14.",
    )
    parser.add_argument(
        "--properties",
        nargs="*",
        default=DEFAULT_PROPERTIES,
        help="Properties to keep in the vector tiles.",
    )
    parser.add_argument(
        "--no-simplify-maxzoom",
        action="store_true",
        help=(
            "Disable line simplification. This preserves geometry most "
            "aggressively, but can create much larger tiles."
        ),
    )
    parser.add_argument(
        "--full-detail",
        type=int,
        default=12,
        help=(
            "Tippecanoe detail at max zoom. Higher values preserve more "
            "coordinate precision. Default: 12."
        ),
    )
    parser.add_argument(
        "--low-detail",
        type=int,
        default=10,
        help="Tippecanoe detail below max zoom. Default: 10.",
    )
    parser.add_argument(
        "--simplification",
        type=float,
        default=1.0,
        help=(
            "Tippecanoe simplification multiplier. Lower values preserve "
            "more geometry. Default: 1.0."
        ),
    )
    parser.add_argument(
        "--color-metadata-output",
        type=Path,
        help=(
            "Output color-bin metadata JSON. Defaults to the PMTiles output "
            "path with .colors.json suffix."
        ),
    )
    parser.add_argument(
        "--color-bins",
        type=int,
        default=25,
        help="Number of quantile color bins for continuous layers. Default: 25.",
    )
    parser.add_argument(
        "--drop-densest-as-needed",
        action="store_true",
        help=(
            "Allow Tippecanoe to drop features from dense low-zoom tiles until "
            "they fit the tile-size limit. Useful for very large continents."
        ),
    )
    parser.add_argument(
        "--drop-smallest-as-needed",
        action="store_true",
        help=(
            "Allow Tippecanoe to drop the smallest features from dense tiles. "
            "Useful for overview layers, but can remove short reaches."
        ),
    )
    parser.add_argument(
        "--maximum-tile-bytes",
        type=int,
        help="Override Tippecanoe's target maximum tile size in bytes.",
    )
    parser.add_argument(
        "--no-tile-size-limit",
        action="store_true",
        help=(
            "Write oversized tiles instead of failing. Use only for testing; "
            "large low-zoom tiles can be slow in browsers."
        ),
    )
    return parser.parse_args()


def require_tippecanoe() -> None:
    if shutil.which("tippecanoe") is None:
        raise SystemExit(
            "tippecanoe was not found on PATH. Install it first, for example: "
            "brew install tippecanoe"
        )


def load_reaches(path: Path, properties: Iterable[str]) -> gpd.GeoDataFrame:
    if not path.exists():
        raise SystemExit(f"Input file does not exist: {path}")

    reaches = gpd.read_file(path)
    if reaches.empty:
        raise SystemExit(f"Input file has no features: {path}")

    if reaches.crs is None:
        raise SystemExit("Input file has no CRS. Reproject to EPSG:4326 before tiling.")

    reaches = reaches.to_crs("EPSG:4326")
    keep_columns = [column for column in properties if column in reaches.columns]
    missing_columns = sorted(set(properties) - set(keep_columns))

    if missing_columns:
        print(f"Skipping missing properties: {', '.join(missing_columns)}")

    if "reach_id" not in keep_columns:
        raise SystemExit("Input file must include a reach_id column.")

    reaches = reaches[keep_columns + ["geometry"]].copy()
    reaches["reach_id"] = reaches["reach_id"].astype(str)

    for column in ("wse", "width", "facc", "dist_out", "slope", "n_chan_max", "strm_order"):
        if column in reaches.columns:
            reaches[column] = reaches[column].round(6)

    return reaches


def write_geojsonl(reaches: gpd.GeoDataFrame, output: Path) -> None:
    with output.open("w", encoding="utf-8") as file_obj:
        for feature in json.loads(reaches.to_json())["features"]:
            feature.pop("id", None)
            file_obj.write(json.dumps(feature, separators=(",", ":")) + "\n")


def colors_at_breaks(cmap_name: str, count: int, reverse: bool = False) -> list[str]:
    colors = [rgb2hex(cm.get_cmap(cmap_name)(value)) for value in np.linspace(0, 1, count)]
    return colors[::-1] if reverse else colors


def quantile_stops(values, bin_count: int) -> list[float]:
    clean_values = values.replace([np.inf, -np.inf], np.nan).dropna().astype(float)
    if clean_values.empty:
        return []

    quantiles = np.linspace(0, 1, max(bin_count, 2))
    stops = np.quantile(clean_values, quantiles)
    stops = np.unique(np.round(stops, 8))

    if len(stops) < 2:
        value = float(stops[0])
        return [value, value + 1]

    return [float(stop) for stop in stops]


def write_color_metadata(reaches: gpd.GeoDataFrame, output: Path, bin_count: int, source: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)

    layers = {}
    for column, config in COLOR_LAYER_CONFIG.items():
        if column not in reaches.columns:
            continue

        stops = quantile_stops(reaches[column], bin_count)
        if not stops:
            continue

        layers[column] = {
            "caption": config["caption"],
            "units": config["units"],
            "classification": "quantile",
            "stops": stops,
            "colors": colors_at_breaks(
                config["cmap"],
                len(stops),
                reverse=bool(config.get("reverse", False)),
            ),
        }

    layers["swot_obs"] = {
        "caption": "SWOT observations",
        "classification": "fixed",
        "stops": SWOT_OBS_STOPS,
        "colors": colors_at_breaks("gnuplot2", len(SWOT_OBS_STOPS)),
    }
    if "n_chan_max" in reaches.columns:
        layers["n_chan_max"] = {
            "caption": "Number of channels",
            "classification": "fixed",
            "stops": N_CHAN_MAX_STOPS,
            "colors": N_CHAN_MAX_COLORS,
        }
    if "strm_order" in reaches.columns:
        layers["strm_order"] = {
            "caption": "Stream order",
            "classification": "categorical",
            "stops": STRM_ORDER_STOPS,
            "colors": STRM_ORDER_COLORS,
        }

    metadata = {
        "schema_version": 1,
        "source": str(source),
        "feature_count": int(len(reaches)),
        "bin_count": int(bin_count),
        "layers": layers,
    }

    with output.open("w", encoding="utf-8") as file_obj:
        json.dump(metadata, file_obj, indent=2)
        file_obj.write("\n")


def build_pmtiles(args: argparse.Namespace, geojsonl_path: Path) -> None:
    args.output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "tippecanoe",
        "--force",
        "--output",
        str(args.output),
        "--layer",
        args.layer,
        "--minimum-zoom",
        str(args.minzoom),
        "--maximum-zoom",
        str(args.maxzoom),
        "--full-detail",
        str(args.full_detail),
        "--low-detail",
        str(args.low_detail),
        "--simplification",
        str(args.simplification),
        "--simplify-only-low-zooms",
        "--extend-zooms-if-still-dropping",
        "--read-parallel",
        str(geojsonl_path),
    ]

    if args.no_simplify_maxzoom:
        command.insert(-1, "--no-line-simplification")

    if args.drop_densest_as_needed:
        command.insert(-1, "--drop-densest-as-needed")

    if args.drop_smallest_as_needed:
        command.insert(-1, "--drop-smallest-as-needed")

    if args.maximum_tile_bytes:
        command.insert(-1, str(args.maximum_tile_bytes))
        command.insert(-2, "--maximum-tile-bytes")

    if args.no_tile_size_limit:
        command.insert(-1, "--no-tile-size-limit")

    subprocess.run(command, check=True)


def main() -> None:
    args = parse_args()
    require_tippecanoe()

    reaches = load_reaches(args.input, args.properties)
    print(f"Loaded {len(reaches):,} reaches from {args.input}")

    with tempfile.TemporaryDirectory() as tmpdir:
        geojsonl_path = Path(tmpdir) / "reaches.geojsonl"
        write_geojsonl(reaches, geojsonl_path)
        build_pmtiles(args, geojsonl_path)

    color_metadata_output = args.color_metadata_output or args.output.with_suffix(".colors.json")
    write_color_metadata(reaches, color_metadata_output, args.color_bins, args.input)

    print(f"Wrote {args.output.resolve()}")
    print(f"Wrote {color_metadata_output.resolve()}")


if __name__ == "__main__":
    main()
