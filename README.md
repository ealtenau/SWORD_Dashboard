<p align="center">
    <img src="https://github.com/ealtenau/SWORD_Dashboard/blob/main/docs/figures/SWORD_explorer_logo.png" width="300">
</p>

# SWORD Explorer Dashboard

Source code for developing and maintaining the online SWORD Explorer Dashboard.
The current application is a React + MapLibre frontend backed by static
geospatial assets generated from SWORD reach and node GeoPackages.

The legacy Dash/Folium application is archived under `legacy/dash_folium/`.
New development is centered on `frontend/` and the generation scripts in
`scripts/`.

## Application Structure

```text
SWORD_Dashboard/
  frontend/                    # React + Vite + MapLibre application
    src/
      components/              # map, side panel, modals, charts, search
      data/                    # tile manifest, color metadata, node profile loaders
      map/                     # MapLibre style/layer/symbology helpers
      styles/app.css           # application styling and mobile bottom sheet
    public/
      tiles/                   # generated PMTiles, manifests, color metadata
      nodes/                   # generated node profile JSON by hbXX/reach_id
  scripts/
    split_continent_reaches.py # split continent reach GeoPackages for PMTiles
    build_reach_pmtiles.py     # build detailed reach PMTiles and color metadata
    build_global_overview_pmtiles.py
    build_reach_search_index.py
    build_node_profiles.py
  assets/                      # shared images used by the React app
  legacy/
    dash_folium/               # archived pre-React Dash/Folium app and scripts
  docs/                        # migration notes and design/reference docs
```

The React app is static. It does not require a Python web server once assets are
built. Map data, search data, legends, and node charts are loaded from static
files under `frontend/public`.

## Required Inputs

To rebuild the current React assets, a fork should start from SWORD GeoPackages:

- One **reach GeoPackage per continent**:
  - `af_sword_reaches_v17b.gpkg`
  - `as_sword_reaches_v17b.gpkg`
  - `eu_sword_reaches_v17b.gpkg`
  - `na_sword_reaches_v17b.gpkg`
  - `oc_sword_reaches_v17b.gpkg`
  - `sa_sword_reaches_v17b.gpkg`
- One **node GeoPackage per continent**:
  - `af_sword_nodes_v17b.gpkg`
  - `as_sword_nodes_v17b.gpkg`
  - `eu_sword_nodes_v17b.gpkg`
  - `na_sword_nodes_v17b.gpkg`
  - `oc_sword_nodes_v17b.gpkg`
  - `sa_sword_nodes_v17b.gpkg`

Reach inputs should include the properties used by the map:

```text
reach_id, river_name, wse, width, facc, dist_out, slope, swot_obs,
swot_orbit, n_chan_max, strm_order, rch_id_up, rch_id_dn, x, y
```

Node inputs should include:

```text
reach_id, node_id, wse, width, facc, dist_out, n_chan_mod, sinuosity
```

Node files may include `x`/`y` columns. If they do not, the exporter derives
coordinates from point geometry. Node profiles are partitioned by level-two
basin (`hbXX`), inferred from the first two digits of `reach_id`.

The SWORD GeoPackages are not committed to this repository. Keep large source
data outside git, for example under `external_data/` or another local data
directory.

## Prerequisites

Python environment:

- Python 3.10+
- GeoPandas
- pandas
- NumPy
- Shapely
- netCDF4 only if using legacy `nodes_hbXX.nc` inputs

Map tile tooling:

```bash
brew install tippecanoe
```

Frontend tooling:

- Node.js 20+
- npm

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Rebuild Static Assets

Run these commands from the repository root.

### 1. Split Continent Reach Files

Large continent reach datasets are split into PMTiles-friendly chunks. This also
writes `frontend/public/tiles/sword_tile_manifest.json` and regenerates
`scripts/build_split_pmtiles.sh`.

```bash
python scripts/split_continent_reaches.py \
  /path/to/af_sword_reaches_v17b.gpkg \
  /path/to/as_sword_reaches_v17b.gpkg \
  /path/to/eu_sword_reaches_v17b.gpkg \
  /path/to/na_sword_reaches_v17b.gpkg \
  /path/to/oc_sword_reaches_v17b.gpkg \
  /path/to/sa_sword_reaches_v17b.gpkg \
  --max-reaches 20000 \
  --minzoom 2
```

Outputs:

```text
external_data/sword_split_reaches/{continent}/*.gpkg
frontend/public/tiles/sword_tile_manifest.json
scripts/build_split_pmtiles.sh
frontend/public/tiles/{continent}_reaches.colors.json
```

### 2. Build Detailed Reach PMTiles

```bash
bash scripts/build_split_pmtiles.sh
```

Outputs:

```text
frontend/public/tiles/af_reaches_001.pmtiles
frontend/public/tiles/as_reaches_001.pmtiles
...
frontend/public/tiles/*_reaches_*.colors.json
```

The app uses the manifest to treat split files as one logical continent.

### 3. Build Node Profile JSON

Build node profiles from continent node GeoPackages:

```bash
python scripts/build_node_profiles.py \
  /path/to/af_sword_nodes_v17b.gpkg \
  /path/to/as_sword_nodes_v17b.gpkg \
  /path/to/eu_sword_nodes_v17b.gpkg \
  /path/to/na_sword_nodes_v17b.gpkg \
  /path/to/oc_sword_nodes_v17b.gpkg \
  /path/to/sa_sword_nodes_v17b.gpkg \
  --output-dir frontend/public/nodes
```

Outputs:

```text
frontend/public/nodes/hb11/{reach_id}.json
frontend/public/nodes/hb12/{reach_id}.json
...
```

The script still supports old `data/nodes_hbXX.nc` files, but GeoPackage input
is the preferred rebuild path.

### 4. Build Reach Search Index

```bash
python scripts/build_reach_search_index.py \
  $(find external_data/sword_split_reaches -name "*.gpkg") \
  --output frontend/public/tiles/reach_search_index.json
```

This enables the React search box to find exact Reach IDs and river-name groups.

### 5. Optional Global Overview PMTiles

The app can show a simplified low-zoom global river layer. If you want to build
one from the SWORD reach GeoPackages:

```bash
python scripts/build_global_overview_pmtiles.py \
  /path/to/af_sword_reaches_v17b.gpkg \
  /path/to/as_sword_reaches_v17b.gpkg \
  /path/to/eu_sword_reaches_v17b.gpkg \
  /path/to/na_sword_reaches_v17b.gpkg \
  /path/to/oc_sword_reaches_v17b.gpkg \
  /path/to/sa_sword_reaches_v17b.gpkg \
  --output frontend/public/tiles/global_reaches_overview.pmtiles \
  --maxzoom 5 \
  --simplify-tolerance 0.005 \
  --min-facc 1000 \
  --merge-connected \
  --snap-tolerance-meters 100
```

If you use a Natural Earth river layer instead, place the PMTiles file in
`frontend/public/tiles/` and point `VITE_SWORD_OVERVIEW_PMTILES` at it.

## Frontend Configuration

The local defaults are in `frontend/.env.example`. Copy it before running:

```bash
cp frontend/.env.example frontend/.env
```

Typical local configuration:

```text
VITE_SWORD_REACHES_SOURCE_LAYER=reaches
VITE_SWORD_CONTINENTS=all
VITE_SWORD_TILE_MANIFEST_JSON=/tiles/sword_tile_manifest.json
VITE_SWORD_NODE_BASE_URL=/nodes
VITE_SWORD_REACH_SEARCH_INDEX_JSON=/tiles/reach_search_index.json
VITE_SWORD_OVERVIEW_PMTILES=/tiles/global_rivers_natural_earth.pmtiles
VITE_SWORD_OVERVIEW_SOURCE_LAYER=rivers
VITE_SWORD_OVERVIEW_MAX_ZOOM=5
VITE_SWORD_DETAIL_MIN_ZOOM=4
VITE_MAP_CENTER_LON=10
VITE_MAP_CENTER_LAT=15
VITE_MAP_ZOOM=1.6
```

If building the overview with `scripts/build_global_overview_pmtiles.py`, use:

```text
VITE_SWORD_OVERVIEW_PMTILES=/tiles/global_reaches_overview.pmtiles
VITE_SWORD_OVERVIEW_COLOR_BINS_JSON=/tiles/global_reaches_overview.colors.json
VITE_SWORD_OVERVIEW_SOURCE_LAYER=reaches
```

## Run Locally

Start the React dev server:

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173
```

To test on a phone on the same Wi-Fi, find your computer IP:

```bash
ipconfig getifaddr en0
```

Start Vite so other devices on the network can reach it:

```bash
npm run dev -- --host 0.0.0.0
```

Then open this on the phone:

```text
http://YOUR_LOCAL_IP:5173
```

## Build the Site

```bash
cd frontend
npm run build
```

The built app is written to:

```text
frontend/dist
```

## Generated Asset Layout

After a full rebuild, the frontend expects:

```text
frontend/public/
  tiles/
    sword_tile_manifest.json
    reach_search_index.json
    af_reaches.colors.json
    af_reaches_001.pmtiles
    af_reaches_002.pmtiles
    ...
    global_reaches_overview.pmtiles        # optional
  nodes/
    hb11/
      11410000016.json
      ...
    hb12/
    ...
```

Large generated assets should generally not be committed to git.

## Deployment Notes

For low-cost hosting, the preferred shape is:

- **Cloudflare Pages** for the React build in `frontend/dist`
- **Cloudflare R2** or similar object storage for `tiles/` and `nodes/`

When hosting assets outside the app domain, update `.env`/deployment variables:

```text
VITE_SWORD_TILE_MANIFEST_JSON=https://static.example.org/tiles/sword_tile_manifest.json
VITE_SWORD_NODE_BASE_URL=https://static.example.org/nodes
VITE_SWORD_REACH_SEARCH_INDEX_JSON=https://static.example.org/tiles/reach_search_index.json
VITE_SWORD_OVERVIEW_PMTILES=https://static.example.org/tiles/global_reaches_overview.pmtiles
```

The static asset host must support CORS. PMTiles hosting should support HTTP
range requests.

## Legacy Dash/Folium App

The pre-React Dash/Folium implementation is archived for reference:

```text
legacy/dash_folium/
  app.py
  app_no_click.py
  assets/
```

That path depends on the old `data/` HTML/NetCDF assets and root-level
`about.md`, `download.md`, and `user_reports.csv` files. It is kept as a
behavioral reference for the React migration, not as the preferred rebuild path.
See `legacy/dash_folium/README.md` for details.

## Documentation

More detailed migration and prototype notes live in:

- `docs/react_frontend_migration_plan.md`
- `docs/one_basin_tile_prototype.md`
- `docs/geospatial_refactor_plan.md`
