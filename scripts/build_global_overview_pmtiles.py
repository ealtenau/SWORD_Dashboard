#!/usr/bin/env python3
"""Build a simplified global PMTiles overview from multiple SWORD reach files."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.ops import linemerge, unary_union

try:
    from shapely import set_precision
except ImportError:  # pragma: no cover - depends on Shapely version
    set_precision = None

from build_reach_pmtiles import (
    DEFAULT_PROPERTIES,
    load_reaches,
    write_color_metadata,
    write_geojsonl,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a simplified global overview PMTiles archive.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Input continent reach vector files.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("frontend/public/tiles/global_reaches_overview.pmtiles"),
        help="Output overview .pmtiles path.",
    )
    parser.add_argument(
        "--layer",
        default="reaches",
        help="Vector tile source-layer name. Default: reaches.",
    )
    parser.add_argument(
        "--minzoom",
        type=int,
        default=0,
        help="Minimum overview zoom. Default: 0.",
    )
    parser.add_argument(
        "--maxzoom",
        type=int,
        default=5,
        help="Maximum overview zoom. Default: 5.",
    )
    parser.add_argument(
        "--simplify-tolerance",
        type=float,
        default=0.005,
        help=(
            "Geometry simplification tolerance in degrees before tiling. "
            "Default: 0.005."
        ),
    )
    parser.add_argument(
        "--min-facc",
        type=float,
        help=(
            "Optional minimum flow accumulation for overview reaches. This "
            "keeps the global view focused on larger rivers."
        ),
    )
    parser.add_argument(
        "--merge-named-rivers",
        action="store_true",
        help=(
            "Merge reaches with the same non-empty river_name within each "
            "continent into longer overview line features."
        ),
    )
    parser.add_argument(
        "--merge-connected",
        action="store_true",
        help=(
            "Merge connected filtered reaches into generalized overview lines. "
            "This is preferred for low-zoom cartographic display."
        ),
    )
    parser.add_argument(
        "--snap-tolerance-meters",
        type=float,
        default=0,
        help=(
            "Optional projected-grid snap tolerance before connected merging. "
            "Try 50-250 if endpoints do not line up exactly. Default: 0."
        ),
    )
    parser.add_argument(
        "--full-detail",
        type=int,
        default=10,
        help="Tippecanoe full detail. Default: 10.",
    )
    parser.add_argument(
        "--low-detail",
        type=int,
        default=8,
        help="Tippecanoe low detail. Default: 8.",
    )
    parser.add_argument(
        "--simplification",
        type=float,
        default=2.0,
        help="Tippecanoe simplification multiplier. Default: 2.0.",
    )
    parser.add_argument(
        "--color-metadata-output",
        type=Path,
        help="Output color-bin metadata JSON. Defaults to .colors.json.",
    )
    parser.add_argument(
        "--color-bins",
        type=int,
        default=25,
        help="Number of global quantile color bins. Default: 25.",
    )
    parser.add_argument(
        "--properties",
        nargs="*",
        default=DEFAULT_PROPERTIES,
        help="Properties to keep in the overview tiles.",
    )
    return parser.parse_args()


def require_tippecanoe() -> None:
    if shutil.which("tippecanoe") is None:
        raise SystemExit(
            "tippecanoe was not found on PATH. Install it first, for example: "
            "brew install tippecanoe"
        )


def continent_id_from_path(path: Path) -> str:
    name = path.stem.lower()
    for continent_id in ("af", "as", "eu", "na", "oc", "sa"):
        if name.startswith(f"{continent_id}_") or f"_{continent_id}_" in name:
            return continent_id
    return "unknown"


def load_global_reaches(args: argparse.Namespace) -> gpd.GeoDataFrame:
    frames = []
    for path in args.inputs:
        reaches = load_reaches(path, args.properties)
        reaches["continent"] = continent_id_from_path(path)
        frames.append(reaches)
        print(f"Loaded {len(reaches):,} reaches from {path}")

    global_reaches = gpd.GeoDataFrame(
        pd.concat(frames, ignore_index=True),
        crs="EPSG:4326",
    )

    if args.min_facc is not None and "facc" in global_reaches.columns:
        global_reaches = global_reaches[global_reaches["facc"] >= args.min_facc].copy()
        print(f"Kept {len(global_reaches):,} reaches with facc >= {args.min_facc}")

    if args.merge_connected:
        global_reaches = merge_connected_reaches(global_reaches, args.snap_tolerance_meters)
        print(f"Merged overview to {len(global_reaches):,} connected line features")
    elif args.merge_named_rivers and "river_name" in global_reaches.columns:
        global_reaches = merge_named_rivers(global_reaches)
        print(f"Merged overview to {len(global_reaches):,} named-river features")

    global_reaches["geometry"] = global_reaches.geometry.simplify(
        args.simplify_tolerance,
        preserve_topology=True,
    )
    global_reaches = global_reaches[~global_reaches.geometry.is_empty].copy()
    return global_reaches


def merge_geometry(geometries):
    merged = linemerge(unary_union(list(geometries)))
    return merged


def iter_line_parts(geometry):
    if geometry.is_empty:
        return

    if geometry.geom_type == "LineString":
        yield geometry
    elif geometry.geom_type == "MultiLineString":
        yield from geometry.geoms
    elif geometry.geom_type == "GeometryCollection":
        for part in geometry.geoms:
            yield from iter_line_parts(part)


def merge_connected_group(group: gpd.GeoDataFrame, snap_tolerance_meters: float) -> list[dict]:
    if snap_tolerance_meters > 0 and set_precision is not None:
        geometries = [set_precision(geometry, snap_tolerance_meters) for geometry in group.geometry]
    elif snap_tolerance_meters > 0:
        print("Shapely set_precision is unavailable; continuing without endpoint snapping.")
        geometries = list(group.geometry)
    else:
        geometries = list(group.geometry)

    merged_geometry = linemerge(unary_union(geometries))
    continent = group["continent"].iloc[0] if "continent" in group.columns else "global"

    records = []
    for index, line in enumerate(iter_line_parts(merged_geometry)):
        records.append(
            {
                "reach_id": f"overview_{continent}_{index}",
                "river_name": "Global overview",
                "continent": continent,
                "geometry": line,
            }
        )

    return records


def merge_connected_reaches(reaches: gpd.GeoDataFrame, snap_tolerance_meters: float) -> gpd.GeoDataFrame:
    projected = reaches.to_crs("EPSG:3857")
    records = []

    for _, group in projected.groupby("continent", sort=False):
        records.extend(merge_connected_group(group, snap_tolerance_meters))

    merged = gpd.GeoDataFrame(records, crs="EPSG:3857")
    merged = merged[~merged.geometry.is_empty].copy()
    return merged.to_crs("EPSG:4326")


def aggregate_group(group: gpd.GeoDataFrame) -> dict:
    first = group.iloc[0]
    record = {
        "reach_id": str(first["reach_id"]),
        "river_name": first.get("river_name", ""),
        "continent": first.get("continent", "unknown"),
        "geometry": merge_geometry(group.geometry),
    }

    for column in ("wse", "width", "dist_out", "slope", "swot_obs", "x", "y"):
        if column in group.columns:
            record[column] = float(group[column].median())

    if "facc" in group.columns:
        record["facc"] = float(group["facc"].max())

    return record


def merge_named_rivers(reaches: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    river_names = reaches["river_name"].fillna("").astype(str).str.strip()
    named = reaches[river_names != ""].copy()
    unnamed = reaches[river_names == ""].copy()

    records = [
        aggregate_group(group)
        for _, group in named.groupby(["continent", "river_name"], sort=False)
    ]

    merged = gpd.GeoDataFrame(records, crs=reaches.crs)
    if unnamed.empty:
        return merged

    return gpd.GeoDataFrame(
        pd.concat([merged, unnamed], ignore_index=True),
        crs=reaches.crs,
    )


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
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--read-parallel",
        str(geojsonl_path),
    ]
    subprocess.run(command, check=True)


def main() -> None:
    args = parse_args()
    require_tippecanoe()

    global_reaches = load_global_reaches(args)
    print(f"Prepared {len(global_reaches):,} global overview reaches")

    with tempfile.TemporaryDirectory() as tmpdir:
        geojsonl_path = Path(tmpdir) / "global_reaches_overview.geojsonl"
        write_geojsonl(global_reaches, geojsonl_path)
        build_pmtiles(args, geojsonl_path)

    color_metadata_output = args.color_metadata_output or args.output.with_suffix(".colors.json")
    write_color_metadata(global_reaches, color_metadata_output, args.color_bins, Path("global"))

    print(f"Wrote {args.output.resolve()}")
    print(f"Wrote {color_metadata_output.resolve()}")


if __name__ == "__main__":
    main()
