#!/usr/bin/env python3
"""Build and validate isolated local v17c demo assets; resume completed stages."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import threading
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
CONTINENTS = ("AF", "AS", "EU", "NA", "OC", "SA")
WORK = ROOT / "external_data/v17c_demo"
TILES = ROOT / "frontend/public/tiles/v17c_demo"
NODES = ROOT / "frontend/public/nodes/v17c_demo"
MANIFEST = TILES / "sword_tile_manifest.json"
SPLITS = WORK / "splits"


def validate(sources: list[Path], settings: dict) -> None:
    manifest = json.loads(MANIFEST.read_text())
    assert {item["id"] for item in manifest["continents"]} == {id.lower() for id in CONTINENTS}
    expected_ids = set()
    for source in sources:
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as connection:
            ids = [str(row[0]) for row in connection.execute("SELECT reach_id FROM reaches")]
        expected_ids.update(ids)
        missing = [id for id in ids if not (NODES / f"hb{id[:2]}" / f"{id}.json").exists()]
        if missing:
            raise RuntimeError(f"Missing node profiles for {len(missing)} reaches in {source.name}")
        sample = json.loads((NODES / f"hb{ids[0][:2]}" / f"{ids[0]}.json").read_text())
        assert sample["node_count"] == len(sample["nodes"])
        assert {"wse_obs_p50", "width_obs_p50"}.issubset(sample["nodes"][0])
    index = json.loads((TILES / "reach_search_index.json").read_text())
    assert {record["reach_id"] for record in index["records"]} == expected_ids
    assert all(record.get("continent_id") in {id.lower() for id in CONTINENTS} for record in index["records"])
    for continent in manifest["continents"]:
        metadata = json.loads((TILES / Path(continent["colorsUrl"]).name).read_text())
        assert {"wse_obs_p50", "width_obs_p50", "slope_obs_p50", "facc_total", "is_mainstem"}.issubset(metadata["layers"])
    # Use the frontend's PMTiles reader to check every detailed archive's actual zoom range.
    subprocess.run(["node", "--input-type=module", "-", str(settings["minzoom"]), str(settings["maxzoom"])], cwd=ROOT / "frontend", check=True, input='''
import { open, readFile } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';
const manifest = JSON.parse(await readFile('public/tiles/v17c_demo/sword_tile_manifest.json','utf8'));
for (const continent of manifest.continents) for (const part of continent.parts) {
  const path = `public${part.pmtilesUrl}`;
  const file = await open(path,'r');
  try {
    const archive = new PMTiles({getKey:()=>path,getBytes:async(offset,length)=>{
      const buffer = Buffer.alloc(length);
      await file.read(buffer,0,length,offset);
      return {data:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};
    }});
    const header = await archive.getHeader();
    if (header.minZoom !== Number(process.argv[2]) || header.maxZoom < Number(process.argv[3])) throw new Error(`Unexpected zoom range: ${path}`);
    const metadata = await archive.getMetadata();
    const fields = metadata.vector_layers.find(layer=>layer.id==='reaches').fields;
    for (const field of ['reach_id','facc_total','is_mainstem','wse_obs_p50','width_obs_p50','slope_obs_p50']) {
      if (!(field in fields)) throw new Error(`Missing ${field}: ${path}`);
    }
    console.log(`${part.id}: zoom ${header.minZoom}–${header.maxZoom}`);
  } finally { await file.close(); }
}
''', text=True)
    print(f"Validated {len(expected_ids):,} searchable reaches and matching node profiles", flush=True)


def activate(settings: dict) -> None:
    overview = settings["overview"]
    destination = ROOT / "frontend/.env.development.local"
    backup = WORK / "previous.env.development.local"
    if destination.exists() and not backup.exists():
        backup.write_text(destination.read_text())
    destination.write_text(f"""VITE_SWORD_REACHES_SOURCE_LAYER=reaches
VITE_SWORD_CONTINENTS=all
VITE_SWORD_TILE_MANIFEST_JSON=/tiles/v17c_demo/sword_tile_manifest.json
VITE_SWORD_NODE_BASE_URL=/nodes/v17c_demo
VITE_SWORD_REACH_SEARCH_INDEX_JSON=/tiles/v17c_demo/reach_search_index.json
VITE_SWORD_OVERVIEW_PMTILES={overview["url"]}
VITE_SWORD_OVERVIEW_COLOR_BINS_JSON=
VITE_SWORD_OVERVIEW_SOURCE_LAYER={overview["source_layer"]}
VITE_SWORD_OVERVIEW_MAX_ZOOM={overview["maxzoom"]}
VITE_SWORD_DETAIL_MIN_ZOOM={settings["detail_min_zoom"]}
VITE_MAP_CENTER_LON=10
VITE_MAP_CENTER_LAT=15
VITE_MAP_ZOOM=1.6
""")
    print("Activated global v17c demo in frontend/.env.development.local", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path, help="Directory containing sword_{AF,AS,EU,NA,OC,SA}_v17c.gpkg")
    parser.add_argument("--activate", action="store_true", help="Switch local development configuration after validation")
    parser.add_argument("--io-engine", choices=("fiona", "pyogrio"), help="Optional GeoPandas reader/writer engine")
    parser.add_argument("--jobs", type=int, default=1, help="Concurrent reach-tile builds (default: 1)")
    parser.add_argument("--config", type=Path, default=ROOT / "scripts/v17c_asset_settings.json",
                        help="Versionable JSON containing tile and overview settings")
    args = parser.parse_args()
    settings = json.loads(args.config.read_text())
    if not 0 <= settings["minzoom"] <= settings["maxzoom"] <= 24:
        parser.error("Config requires 0 <= minzoom <= maxzoom <= 24")
    if settings["max_reaches"] < 1 or settings["full_detail"] < 1 or settings["low_detail"] < 1 or settings["simplification"] <= 0:
        parser.error("Split size, detail, and simplification must be positive")
    if settings["detail_min_zoom"] < settings["minzoom"]:
        parser.error("Display minimum zoom cannot be below native tile minimum zoom")
    tile_options = ["--minzoom", str(settings["minzoom"]), "--maxzoom", str(settings["maxzoom"]),
                    "--full-detail", str(settings["full_detail"]), "--low-detail", str(settings["low_detail"]),
                    "--simplification", str(settings["simplification"])]
    if args.jobs < 1:
        parser.error("--jobs must be positive")
    sources = [args.source_dir.resolve() / f"sword_{id}_v17c.gpkg" for id in CONTINENTS]
    for source in sources:
        if not source.exists():
            parser.error(f"Missing source: {source}")
    for directory in (WORK, TILES, NODES):
        directory.mkdir(parents=True, exist_ok=True)
    signature = hashlib.sha256()
    for source in sources:
        signature.update(f"{source}:{source.stat().st_size}:{source.stat().st_mtime_ns}".encode())
    for script in ("build_v17c_demo.py", "split_continent_reaches.py", "build_reach_pmtiles.py",
                   "build_node_profiles.py", "build_reach_search_index.py"):
        signature.update((ROOT / "scripts" / script).read_bytes())
    signature.update(json.dumps(settings, sort_keys=True).encode())
    state_path = WORK / "build_state.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if state.get("signature") != signature.hexdigest():
        state = {"signature": signature.hexdigest(), "completed": []}
    environment = {**os.environ, "PYTHONUNBUFFERED": "1", "MPLCONFIGDIR": str(WORK / "matplotlib"),
                   "PATH": str(Path(sys.executable).parent) + os.pathsep + os.environ.get("PATH", "")}

    if args.io_engine:
        environment["SWORD_IO_ENGINE"] = args.io_engine

    checkpoint_lock = threading.Lock()

    def run(stage: str, command: list[str], outputs: list[Path]) -> None:
        if stage in state["completed"] and all(path.exists() for path in outputs):
            print(f"Already complete: {stage}", flush=True)
            return
        print(f"Building: {stage}", flush=True)
        started = time.monotonic()
        with (WORK / f"{stage}.log").open("w") as log:
            subprocess.run(command, cwd=ROOT, env=environment, stdout=log, stderr=subprocess.STDOUT, check=True)
        with checkpoint_lock:
            state["completed"].append(stage)
            state_path.write_text(json.dumps(state, indent=2) + "\n")
        print(f"Completed: {stage} ({time.monotonic()-started:.0f}s)", flush=True)

    python = sys.executable
    source_args = [str(source) for source in sources]
    run("split", [python, "scripts/split_continent_reaches.py", *source_args,
                  "--max-reaches", str(settings["max_reaches"]), *tile_options,
                  "--output-dir", str(SPLITS), "--pmtiles-dir", str(TILES),
                  "--tile-url-prefix", "/tiles/v17c_demo", "--manifest-output", str(MANIFEST),
                  "--build-commands-output", str(ROOT / "scripts/build_split_pmtiles.sh")], [MANIFEST])
    manifest = json.loads(MANIFEST.read_text())
    tile_tasks = []
    for continent in manifest["continents"]:
        for part in continent["parts"]:
            id = part["id"]
            output = TILES / f"{id}.pmtiles"
            tile_tasks.append((id, [python, "scripts/build_reach_pmtiles.py", str(SPLITS / continent["id"] / f"{id}.gpkg"),
                     "--output", str(output), *tile_options,
                     *(["--drop-densest-as-needed"] if settings["drop_densest_as_needed"] else []),
                     *(["--maximum-tile-bytes", str(settings["maximum_tile_bytes"])] if settings["maximum_tile_bytes"] else [])],
                [output, output.with_suffix(".colors.json")]))
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        list(executor.map(lambda task: run(*task), tile_tasks))
    for source in sources:
        id = source.stem.split("_")[1].lower()
        run(f"nodes_{id}", [python, "scripts/build_node_profiles.py", str(source), "--output-dir", str(NODES)], [NODES])
    split_files = sorted(SPLITS.glob("*/*.gpkg"))
    run("search", [python, "scripts/build_reach_search_index.py", *map(str, split_files),
                   "--output", str(TILES / "reach_search_index.json")], [TILES / "reach_search_index.json"])
    overview = settings["overview"]
    if overview["url"].startswith("/"):
        overview_path = ROOT / "frontend/public" / overview["url"].lstrip("/")
        if not overview_path.exists():
            overview_path.parent.mkdir(parents=True, exist_ok=True)
            run("natural_earth", ["curl", "--fail", "--location", "--output", str(overview_path),
                                 overview["download_url"]], [overview_path])
        else:
            print(f"Using existing Natural Earth overview: {overview_path}", flush=True)
    validate(sources, settings)
    if args.activate:
        activate(settings)
    print("Demo asset build complete", flush=True)


if __name__ == "__main__":
    main()
