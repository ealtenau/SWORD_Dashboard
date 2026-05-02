#!/usr/bin/env python3
"""Export SWORD node profiles from NetCDF to per-reach JSON files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

try:
    import netCDF4 as nc
except ImportError as exc:  # pragma: no cover - depends on local SWORD env
    raise SystemExit(
        "netCDF4 is required to export node profiles. Install/use the SWORD "
        "Python environment before running this script."
    ) from exc


NODE_VARIABLES = (
    "x",
    "y",
    "reach_id",
    "node_id",
    "wse",
    "width",
    "facc",
    "dist_out",
    "n_chan_mod",
    "sinuosity",
    "node_order",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export SWORD node-level profiles as static JSON by reach.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Input nodes_hb*.nc file(s).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("frontend/public/nodes"),
        help="Output directory for /nodes/hbXX/{reach_id}.json files.",
    )
    parser.add_argument(
        "--precision",
        type=int,
        default=6,
        help="Decimal precision for floating point values. Default: 6.",
    )
    return parser.parse_args()


def as_array(dataset, variable: str) -> np.ndarray:
    values = dataset["nodes"][variable][:]
    if np.ma.isMaskedArray(values):
        values = values.filled(np.nan)
    return np.asarray(values)


def to_value(value, precision: int):
    if value is None:
        return None

    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, float):
        if not np.isfinite(value):
            return None
        return round(value, precision)

    if isinstance(value, int):
        return value

    return value


def basin_id_from_path(path: Path) -> str:
    stem = path.stem
    if stem.startswith("nodes_hb"):
        return stem.replace("nodes_", "")
    return stem


def export_file(path: Path, output_dir: Path, precision: int) -> int:
    basin_id = basin_id_from_path(path)
    basin_output_dir = output_dir / basin_id
    basin_output_dir.mkdir(parents=True, exist_ok=True)

    with nc.Dataset(path) as dataset:
        arrays = {variable: as_array(dataset, variable) for variable in NODE_VARIABLES}

    reach_ids = arrays["reach_id"].astype(np.int64)
    unique_reach_ids = np.unique(reach_ids)

    for reach_id in unique_reach_ids:
        indices = np.where(reach_ids == reach_id)[0]
        order = np.argsort(arrays["dist_out"][indices])
        sorted_indices = indices[order]

        nodes = []
        for index in sorted_indices:
            nodes.append(
                {
                    "x": to_value(arrays["x"][index], precision),
                    "y": to_value(arrays["y"][index], precision),
                    "node_id": str(int(arrays["node_id"][index])),
                    "wse": to_value(arrays["wse"][index], precision),
                    "width": to_value(arrays["width"][index], precision),
                    "facc": to_value(arrays["facc"][index], precision),
                    "dist_out": to_value(arrays["dist_out"][index], precision),
                    "n_chan_mod": to_value(arrays["n_chan_mod"][index], precision),
                    "sinuosity": to_value(arrays["sinuosity"][index], precision),
                    "node_order": to_value(arrays["node_order"][index], precision),
                }
            )

        profile = {
            "reach_id": str(int(reach_id)),
            "basin_id": basin_id,
            "node_count": len(nodes),
            "nodes": nodes,
        }

        output_path = basin_output_dir / f"{int(reach_id)}.json"
        with output_path.open("w", encoding="utf-8") as file_obj:
            json.dump(profile, file_obj, separators=(",", ":"))
            file_obj.write("\n")

    return len(unique_reach_ids)


def main() -> None:
    args = parse_args()
    total_reaches = 0

    for input_path in args.inputs:
        if not input_path.exists():
            raise SystemExit(f"Input file does not exist: {input_path}")

        reach_count = export_file(input_path, args.output_dir, args.precision)
        total_reaches += reach_count
        print(f"Exported {reach_count:,} reach profiles from {input_path}")

    print(f"Wrote {total_reaches:,} reach profiles to {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
