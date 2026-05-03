#!/usr/bin/env python3
"""Build a static SWORD reach search index for the React frontend."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import geopandas as gpd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a compact JSON index for searching SWORD reaches by "
            "reach_id or river_name."
        ),
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Input reach vector files, such as continent or split GeoPackages.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("frontend/public/tiles/reach_search_index.json"),
        help="Output search index JSON path.",
    )
    return parser.parse_args()


def infer_continent_id(path: Path) -> str | None:
    match = re.match(r"^(af|as|eu|na|oc|sa)(?:_|-)", path.stem.lower())
    return match.group(1) if match else None


def clean_text(value) -> str:
    if value is None:
        return ""

    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def load_records(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Input file does not exist: {path}")

    reaches = gpd.read_file(path)
    if reaches.empty:
        return []

    if reaches.crs is None:
        raise SystemExit(f"Input file has no CRS: {path}")

    reaches = reaches.to_crs("EPSG:4326")
    if "reach_id" not in reaches.columns:
        raise SystemExit(f"Input file must include a reach_id column: {path}")

    continent_id = infer_continent_id(path)
    centroids = reaches.geometry.representative_point()
    bounds = reaches.geometry.bounds

    records = []
    for index, row in reaches.iterrows():
        reach_id = clean_text(row.get("reach_id"))
        if not reach_id:
            continue

        record = {
            "reach_id": reach_id,
            "river_name": clean_text(row.get("river_name")),
            "lon": round(float(centroids.loc[index].x), 6),
            "lat": round(float(centroids.loc[index].y), 6),
            "bbox": [
                round(float(bounds.loc[index, "minx"]), 6),
                round(float(bounds.loc[index, "miny"]), 6),
                round(float(bounds.loc[index, "maxx"]), 6),
                round(float(bounds.loc[index, "maxy"]), 6),
            ],
        }

        if continent_id:
            record["continent_id"] = continent_id

        records.append(record)

    return records


def main() -> None:
    args = parse_args()
    records_by_id: dict[str, dict] = {}

    for input_path in args.inputs:
        records = load_records(input_path)
        for record in records:
            records_by_id.setdefault(record["reach_id"], record)
        print(f"Indexed {len(records):,} reaches from {input_path}")

    output_records = sorted(records_by_id.values(), key=lambda record: record["reach_id"])
    output = {
        "schema_version": 1,
        "feature_count": len(output_records),
        "records": output_records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as file_obj:
        json.dump(output, file_obj, separators=(",", ":"))
        file_obj.write("\n")

    print(f"Wrote {len(output_records):,} search records to {args.output}")


if __name__ == "__main__":
    main()
