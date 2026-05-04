#!/usr/bin/env python3
"""Export SWORD node profiles from NetCDF or GeoPackage to per-reach JSON files."""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

gpd = None
np = None
nc = None


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
        nargs="*",
        type=Path,
        help=(
            "Input node file(s), such as nodes_hb*.nc or continent node "
            "GeoPackages. If omitted, node files in --input-dir are exported."
        ),
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Export every discovered node file found in --input-dir.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data"),
        help="Directory searched by --all or when no input files are provided.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Search --input-dir recursively when discovering node files.",
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


def discover_inputs(input_dir: Path, recursive: bool = False) -> list[Path]:
    patterns = ("nodes_hb*.nc", "*nodes*.gpkg", "*node*.gpkg")
    paths = []
    glob = input_dir.rglob if recursive else input_dir.glob
    for pattern in patterns:
        paths.extend(glob(pattern))
    return sorted(set(paths))


def load_numpy() -> None:
    global np

    if np is not None:
        return

    try:
        import numpy as numpy
    except ImportError as exc:  # pragma: no cover - depends on local SWORD env
        raise SystemExit(
            "numpy is required to export node profiles. Install/use the SWORD "
            "Python environment before running this script."
        ) from exc

    np = numpy


def load_netcdf_dependencies() -> None:
    global nc

    load_numpy()

    if nc is not None:
        return

    try:
        import netCDF4 as netcdf
    except ImportError as exc:  # pragma: no cover - depends on local SWORD env
        raise SystemExit(
            "netCDF4 is required to export node profiles from NetCDF. "
            "Install/use the SWORD Python environment before running this script."
        ) from exc

    nc = netcdf


def load_vector_dependencies() -> None:
    global gpd

    load_numpy()

    if gpd is not None:
        return

    try:
        import geopandas as geopandas
    except ImportError as exc:  # pragma: no cover - depends on local SWORD env
        raise SystemExit(
            "geopandas is required to export node profiles from GeoPackage/vector "
            "files. Install/use the SWORD Python environment before running this script."
        ) from exc

    gpd = geopandas


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


def reach_id_to_string(value) -> str:
    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return str(int(value))

    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def basin_id_from_reach_id(reach_id) -> str:
    reach_id_text = reach_id_to_string(reach_id)
    if len(reach_id_text) < 2:
        raise ValueError(f"Unable to infer level-two basin from reach_id: {reach_id}")
    return f"hb{reach_id_text[:2]}"


def basin_id_from_path(path: Path) -> str:
    stem = path.stem
    if stem.startswith("nodes_hb"):
        return stem.replace("nodes_", "")
    return stem


def node_order_from_node_id(node_id) -> int | None:
    node_id_text = reach_id_to_string(node_id)
    try:
        return int(node_id_text[-4:-1])
    except ValueError:
        return None


def write_profile(output_dir: Path, basin_id: str, reach_id, nodes: list[dict]) -> None:
    profile = {
        "reach_id": reach_id_to_string(reach_id),
        "basin_id": basin_id,
        "node_count": len(nodes),
        "nodes": nodes,
    }

    basin_output_dir = output_dir / basin_id
    basin_output_dir.mkdir(parents=True, exist_ok=True)
    output_path = basin_output_dir / f"{reach_id_to_string(reach_id)}.json"
    with output_path.open("w", encoding="utf-8") as file_obj:
        json.dump(profile, file_obj, separators=(",", ":"))
        file_obj.write("\n")


def export_netcdf_file(path: Path, output_dir: Path, precision: int) -> int:
    load_netcdf_dependencies()

    basin_id = basin_id_from_path(path)

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

        write_profile(output_dir, basin_id, reach_id, nodes)

    return len(unique_reach_ids)


def vector_value(row, column: str, precision: int):
    if column not in row.index:
        return None
    return to_value(row[column], precision)


def add_coordinate_columns(nodes) -> None:
    if "x" in nodes.columns and "y" in nodes.columns:
        return

    if nodes.geometry is None:
        raise SystemExit("Node vector input must include x/y columns or point geometry.")

    if nodes.crs is None:
        raise SystemExit("Node vector input has geometry but no CRS. Reproject to EPSG:4326 first.")

    nodes_4326 = nodes.to_crs("EPSG:4326")
    if "x" not in nodes.columns:
        nodes["x"] = nodes_4326.geometry.x
    if "y" not in nodes.columns:
        nodes["y"] = nodes_4326.geometry.y


def export_vector_file(path: Path, output_dir: Path, precision: int) -> int:
    load_vector_dependencies()

    start_time = time.perf_counter()
    print(f"Loading node GeoPackage: {path}", flush=True)
    nodes = gpd.read_file(path)
    print(f"Loaded {len(nodes):,} nodes from {path} in {time.perf_counter() - start_time:.1f}s", flush=True)
    if nodes.empty:
        return 0

    if "reach_id" not in nodes.columns:
        raise SystemExit(f"Input node vector file must include a reach_id column: {path}")
    if "node_id" not in nodes.columns:
        raise SystemExit(f"Input node vector file must include a node_id column: {path}")

    add_coordinate_columns(nodes)
    nodes["_reach_id_text"] = nodes["reach_id"].map(reach_id_to_string)
    reach_total = nodes["_reach_id_text"].nunique()
    print(f"Writing {reach_total:,} reach profile(s) from {path}", flush=True)

    reach_count = 0
    for reach_id_text, group in nodes.groupby("_reach_id_text", sort=True):
        if "dist_out" in group.columns:
            group = group.sort_values("dist_out")

        basin_id = basin_id_from_reach_id(reach_id_text)
        profile_nodes = []

        for row in group.to_dict("records"):
            node_order = row.get("node_order")
            if node_order is not None:
                node_order = to_value(node_order, precision)
            if node_order is None:
                node_order = node_order_from_node_id(row["node_id"])

            profile_nodes.append(
                {
                    "x": to_value(row.get("x"), precision),
                    "y": to_value(row.get("y"), precision),
                    "node_id": reach_id_to_string(row["node_id"]),
                    "wse": to_value(row.get("wse"), precision),
                    "width": to_value(row.get("width"), precision),
                    "facc": to_value(row.get("facc"), precision),
                    "dist_out": to_value(row.get("dist_out"), precision),
                    "n_chan_mod": to_value(row.get("n_chan_mod"), precision),
                    "sinuosity": to_value(row.get("sinuosity"), precision),
                    "node_order": node_order,
                }
            )

        write_profile(output_dir, basin_id, reach_id_text, profile_nodes)
        reach_count += 1
        if reach_count % 10000 == 0:
            print(f"  Wrote {reach_count:,}/{reach_total:,} reach profiles from {path}", flush=True)

    print(
        f"Finished {reach_count:,} reach profiles from {path} in {time.perf_counter() - start_time:.1f}s",
        flush=True,
    )
    return reach_count


def export_file(path: Path, output_dir: Path, precision: int) -> int:
    if path.suffix.lower() == ".nc":
        return export_netcdf_file(path, output_dir, precision)
    return export_vector_file(path, output_dir, precision)


def main() -> None:
    args = parse_args()
    total_reaches = 0
    input_paths = args.inputs

    if args.all or not input_paths:
        input_paths = discover_inputs(args.input_dir, args.recursive)

    if not input_paths:
        raise SystemExit(f"No node files found in {args.input_dir}")

    print(f"Exporting {len(input_paths):,} node file(s)")

    for input_path in input_paths:
        if not input_path.exists():
            raise SystemExit(f"Input file does not exist: {input_path}")

        reach_count = export_file(input_path, args.output_dir, args.precision)
        total_reaches += reach_count
        print(f"Exported {reach_count:,} reach profiles from {input_path}")

    print(f"Wrote {total_reaches:,} reach profiles to {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
