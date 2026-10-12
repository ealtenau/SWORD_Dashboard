# Reproduce the v17c assets with verified production tile settings

The [production app](https://sword-dashboard.pages.dev/) was inspected on
2026-10-11. All 19 deployed reach archives contain the same Tippecanoe options:
minimum zoom 4, maximum zoom 16, full detail 14, low detail 10, simplification
0.75, `--simplify-only-low-zooms`, `--extend-zooms-if-still-dropping`,
`--read-parallel`, and `--drop-densest-as-needed`. Both production and the local
installation use Tippecanoe 2.79.0. The overview is Natural Earth, native zooms
0–5, source layer `rivers`.

The embedded commands are saved in [production-tile-settings.json](production-tile-settings.json).
The production split count is 19; the current v17c build produces 20 parts with
the configured 15,000-reach split limit and 2,000,000-byte maximum tile size.
The production split threshold cannot be recovered from PMTiles metadata.
Updated source geometries, attributes, and split boundaries
can change density dropping even with identical build options. Matching these
options reproduces production's tile precision and zoom range, but does not
promise identical coverage or byte-for-byte output.

## Files to keep in Git

- `scripts/v17c_asset_settings.json`: editable tile and display settings.
- `scripts/build_v17c_demo.py`: build runner; reads that JSON.
- The existing split, reach tile, node profile, and search index Python scripts.
- This guide and `docs/production-tile-settings.json`.

These files are versionable, but the newly created files are not yet committed
or pushed. `scripts/build_split_pmtiles.sh` is a generated, machine-specific
helper intentionally ignored by Git. It is recreated by the splitter; it is
not required by the runner. Assets and source data remain outside Git.

## Build from a fresh checkout

Use a Python environment with GeoPandas, NumPy, pandas, matplotlib, and Fiona
(or optionally pyogrio). Install Tippecanoe 2.79.0 to match production. Node,
frontend dependencies (`cd frontend && npm install`), and curl are required.

From the repository root:

```bash
conda activate sword
python scripts/build_v17c_demo.py \
  /Users/ealtenau/Documents/Work/UNC/SWORD/v17c/gpkg \
  --config scripts/v17c_asset_settings.json \
  --jobs 2 \
  --activate
```

Substitute your source directory on another machine. It must contain the six
`sword_{AF,AS,EU,NA,OC,SA}_v17c.gpkg` files, each with `reaches` and `nodes`
layers. If pyogrio is installed, add `--io-engine pyogrio` for faster vector I/O.
The default Fiona reader works as well.

The runner splits reaches, builds PMTiles and continent-wide quantiles, exports
node JSON including SWOT WSE/width, and builds the global search index. It
copies the exact public production Natural Earth overview locally; it does not
create a SWORD overview. That download needs network access. For offline use,
keep `frontend/public/tiles/global_rivers_natural_earth.pmtiles` locally.

Activation happens after coverage and tile metadata validation. It updates only
`frontend/.env.development.local`, including overview source layer `rivers`,
overview maximum display zoom 5, and detailed reach minimum display zoom 4.
The overview and reach layers overlap between zooms 4 and 5, as in production.
Nothing is uploaded, committed, pushed, or deployed by the runner.

## Adjust settings yourself

Edit **`scripts/v17c_asset_settings.json`**, then rerun the command above.
The native tile zooms (`minzoom`/`maxzoom`) and display transition
(`detail_min_zoom` and `overview.maxzoom`) are separate settings. Higher
`maximum_tile_bytes` allows larger tiles before density dropping; `null` uses
Tippecanoe's default. `drop_densest_as_needed` controls density dropping.
`full_detail`, `low_detail`, and `simplification` control line precision.

Changing source files, settings, or build scripts invalidates the resume cache
and rebuilds the workflow. Unchanged runs resume completed stages. The first
run after the runner/config update also invalidates the previous cache.

To rebuild just one existing split without running the entire workflow:

```bash
python scripts/build_reach_pmtiles.py \
  external_data/v17c_demo/splits/na/na_reaches_001.gpkg \
  --output frontend/public/tiles/v17c_demo/na_reaches_001.pmtiles \
  --minzoom 4 --maxzoom 16 --full-detail 14 --low-detail 10 \
  --simplification 0.75 --drop-densest-as-needed \
  --maximum-tile-bytes 2000000
```

The above command uses the current v17c tile settings. If you
change it manually, record the change in the JSON too; the full runner follows
that JSON. Restart the dev server and reload the page after replacing tiles.

## Local output

| Asset | Path |
|---|---|
| Reach PMTiles, quantiles, manifest, search | `frontend/public/tiles/v17c_demo/` |
| Natural Earth overview | `frontend/public/tiles/global_rivers_natural_earth.pmtiles` |
| Node profiles | `frontend/public/nodes/v17c_demo/hbXX/` |
| Split GeoPackages | `external_data/v17c_demo/splits/` |
| Logs and resume state | `external_data/v17c_demo/` |

Launch with `cd frontend && npm run dev`. All current map and layer changes are
preserved; these instructions govern asset generation and data URLs.
