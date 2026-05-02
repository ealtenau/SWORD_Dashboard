#!/usr/bin/env python3
"""Split large continent reach GeoPackages into spatial PMTiles-ready chunks."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Union

import geopandas as gpd
import pandas as pd

from build_global_overview_pmtiles import continent_id_from_path
from build_reach_pmtiles import DEFAULT_PROPERTIES, load_reaches, write_color_metadata


CONTINENT_NAMES = {
    "af": "Africa",
    "as": "Asia",
    "eu": "Europe & Middle East",
    "na": "North America",
    "oc": "Oceania",
    "sa": "South America",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Split large SWORD continent reach files into spatial chunks.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Input continent reach GeoPackage/vector files.",
    )
    parser.add_argument(
        "--max-reaches",
        type=int,
        default=20000,
        help="Maximum features per output subset. Default: 20000.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("external_data/sword_split_reaches"),
        help="Directory for split GeoPackages.",
    )
    parser.add_argument(
        "--pmtiles-dir",
        type=Path,
        default=Path("frontend/public/tiles"),
        help="Directory where built PMTiles are expected to live.",
    )
    parser.add_argument(
        "--tile-url-prefix",
        default="/tiles",
        help="URL prefix for PMTiles in the generated manifest. Default: /tiles.",
    )
    parser.add_argument(
        "--manifest-output",
        type=Path,
        default=Path("frontend/public/tiles/sword_tile_manifest.json"),
        help="Output tile manifest JSON path.",
    )
    parser.add_argument(
        "--build-commands-output",
        type=Path,
        default=Path("scripts/build_split_pmtiles.sh"),
        help="Output helper shell script for building PMTiles from splits.",
    )
    parser.add_argument(
        "--layer",
        default="reaches",
        help="Vector tile source-layer name. Default: reaches.",
    )
    parser.add_argument(
        "--minzoom",
        type=int,
        default=4,
        help="Tippecanoe minimum zoom for split PMTiles. Default: 4.",
    )
    parser.add_argument(
        "--maxzoom",
        type=int,
        default=16,
        help="Tippecanoe maximum zoom for split PMTiles. Default: 16.",
    )
    parser.add_argument(
        "--full-detail",
        type=int,
        default=14,
        help="Tippecanoe full detail for split PMTiles. Default: 14.",
    )
    parser.add_argument(
        "--low-detail",
        type=int,
        default=10,
        help="Tippecanoe low detail for split PMTiles. Default: 10.",
    )
    parser.add_argument(
        "--simplification",
        type=float,
        default=0.75,
        help="Tippecanoe simplification for split PMTiles. Default: 0.75.",
    )
    parser.add_argument(
        "--properties",
        nargs="*",
        default=DEFAULT_PROPERTIES,
        help="Properties to keep in split files.",
    )
    return parser.parse_args()


def spatial_sort(reaches: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if hasattr(reaches, "hilbert_distance"):
        return reaches.assign(_sort_key=reaches.hilbert_distance()).sort_values("_sort_key").drop(columns="_sort_key")

    centroids = reaches.geometry.centroid
    return (
        reaches.assign(_sort_x=centroids.x, _sort_y=centroids.y)
        .sort_values(["_sort_x", "_sort_y"])
        .drop(columns=["_sort_x", "_sort_y"])
    )


def split_frame(reaches: gpd.GeoDataFrame, max_reaches: int) -> list[gpd.GeoDataFrame]:
    if len(reaches) <= max_reaches:
        return [reaches]

    sorted_reaches = spatial_sort(reaches)
    chunk_count = math.ceil(len(sorted_reaches) / max_reaches)
    return [
        sorted_reaches.iloc[index * max_reaches : (index + 1) * max_reaches].copy()
        for index in range(chunk_count)
    ]


def write_split_file(chunk: gpd.GeoDataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    chunk.to_file(output_path, layer="reaches", driver="GPKG")


def shell_quote(path: Union[Path, str]) -> str:
    text = str(path)
    return "'" + text.replace("'", "'\"'\"'") + "'"


def build_command(args: argparse.Namespace, split_path: Path, pmtiles_path: Path) -> str:
    return " ".join(
        [
            "python",
            "scripts/build_reach_pmtiles.py",
            shell_quote(split_path),
            "--output",
            shell_quote(pmtiles_path),
            "--layer",
            args.layer,
            "--minzoom",
            str(args.minzoom),
            "--maxzoom",
            str(args.maxzoom),
            "--full-detail",
            str(args.full_detail),
            "--low-detail",
            str(args.low_detail),
            "--simplification",
            str(args.simplification),
            "--drop-densest-as-needed",
        ]
    )


def process_input(args: argparse.Namespace, input_path: Path) -> tuple[dict, list[str]]:
    continent_id = continent_id_from_path(input_path)
    continent_name = CONTINENT_NAMES.get(continent_id, continent_id.upper())
    reaches = load_reaches(input_path, args.properties)
    chunks = split_frame(reaches, args.max_reaches)
    print(f"{continent_name}: {len(reaches):,} reaches -> {len(chunks)} file(s)")

    colors_path = args.pmtiles_dir / f"{continent_id}_reaches.colors.json"
    write_color_metadata(reaches, colors_path, 25, input_path)

    manifest_parts = []
    commands = []
    for index, chunk in enumerate(chunks, start=1):
        suffix = f"_{index:03d}" if len(chunks) > 1 else ""
        base_name = f"{continent_id}_reaches{suffix}"
        split_path = args.output_dir / continent_id / f"{base_name}.gpkg"
        pmtiles_path = args.pmtiles_dir / f"{base_name}.pmtiles"

        write_split_file(chunk, split_path)
        manifest_parts.append(
            {
                "id": base_name,
                "pmtilesUrl": f"{args.tile_url_prefix}/{base_name}.pmtiles",
            }
        )
        commands.append(build_command(args, split_path, pmtiles_path))

    manifest_entry = {
        "id": continent_id,
        "name": continent_name,
        "sourceLayer": args.layer,
        "colorsUrl": f"{args.tile_url_prefix}/{continent_id}_reaches.colors.json",
        "parts": manifest_parts,
    }
    return manifest_entry, commands


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.pmtiles_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries = []
    commands = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "",
        "# Generated by scripts/split_continent_reaches.py",
        "",
    ]

    for input_path in args.inputs:
        if not input_path.exists():
            raise SystemExit(f"Input file does not exist: {input_path}")
        manifest_entry, input_commands = process_input(args, input_path)
        manifest_entries.append(manifest_entry)
        commands.extend(input_commands)
        commands.append("")

    manifest = {
        "schema_version": 1,
        "continents": manifest_entries,
    }

    args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest_output.open("w", encoding="utf-8") as file_obj:
        json.dump(manifest, file_obj, indent=2)
        file_obj.write("\n")

    args.build_commands_output.parent.mkdir(parents=True, exist_ok=True)
    with args.build_commands_output.open("w", encoding="utf-8") as file_obj:
        file_obj.write("\n".join(commands))
        file_obj.write("\n")

    print(f"Wrote manifest: {args.manifest_output.resolve()}")
    print(f"Wrote build commands: {args.build_commands_output.resolve()}")


if __name__ == "__main__":
    main()
