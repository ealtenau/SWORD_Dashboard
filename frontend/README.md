# SWORD Explorer Frontend

React + Vite + MapLibre application for the SWORD Explorer.

The frontend is a static app. It reads PMTiles, search indexes, legend metadata,
and node profile JSON from `public/`, or from remote URLs configured with Vite
environment variables.

## Local Development

Install dependencies:

```bash
npm install
```

Copy the local configuration:

```bash
cp .env.example .env
```

Start the dev server:

```bash
npm run dev
```

To test from another device on the same network:

```bash
npm run dev -- --host 0.0.0.0
```

## Local SWOT Layer Development

Use a development-only configuration to test updated reach tiles without uploading
anything to R2. From `frontend/`, copy `.env.development.local.example` to
`.env.development.local` and restart `npm run dev`. This file is ignored by git and
is loaded only in development mode. It selects North America, centers the map there,
and disables the global overview so the local reach data is used directly.

From the repository root, build the local tiles using a Python environment with
GeoPandas, NumPy, pandas, and matplotlib, plus Tippecanoe on PATH:

```bash
python scripts/build_reach_pmtiles.py /path/to/sword_NA_v17c.gpkg \
  --output frontend/public/tiles/na_swot_dev.pmtiles \
  --minzoom 3 --maxzoom 10 --drop-densest-as-needed
```

These development settings cap detail at zoom 10 and permit feature dropping in
dense tiles. Use the normal production build settings for final data generation.
The builder also writes `na_swot_dev.colors.json`. Create
`frontend/public/tiles/na_swot_dev_facc_total_manifest.json` with:

```json
{
  "schema_version": 1,
  "continents": [{
    "id": "na",
    "name": "North America",
    "sourceLayer": "reaches",
    "colorsUrl": "/tiles/na_swot_dev.colors.json",
    "parts": [{
      "id": "na_swot_dev",
      "pmtilesUrl": "/tiles/na_swot_dev.pmtiles"
    }]
  }]
}
```

The reach builder maps the v17c `stream_order` source column to the existing
`strm_order` tile field so the Stream Order layer and hover values remain compatible.

Flow accumulation reads `facc_total` and uses the former stream-order palette with its quantile
classification. Mainstem / Side channel uses `is_mainstem`: true/1 is blue and
false/0 is red, with white for missing values. This control replaces Stream Order.

The three SWOT median layers use the WSE, Width, and Slope palettes and the same
quantile method (25 stops by default), calculated independently from each observed
attribute's non-null values. Missing values are white. `slope_obs_p50` is converted
from m/m to m/km in the tiles and metadata; the source and intermediate split
GeoPackages remain in m/m. Older split files must be regenerated if they lack the
new observed or numbered connectivity fields.

The Reach ID tooltip combines non-zero `rch_id_up_1` through `_4` and
`rch_id_dn_1` through `_4`, ignoring nulls. It never uses `_main` fields. Legacy
`rch_id_up` and `rch_id_dn` are used only when the numbered fields are absent.

Generate the matching local node profiles from the combined GeoPackage:

```bash
python scripts/build_node_profiles.py /path/to/sword_NA_v17c.gpkg \
  --output-dir frontend/public/nodes/na_swot_dev
```

The development configuration sets `VITE_SWORD_NODE_BASE_URL=/nodes/na_swot_dev`.
WSE and Width charts overlay `wse_obs_p50` and `width_obs_p50` on the same axes as
the original SWORD series. SWOT uses light blue points and a dark blue line, with
series labels in the legend and hover tooltip. Missing observations create gaps
in the line rather than zero values. Profiles without SWOT fields still display
the original SWORD data.

Search indexes are separate assets; provide a matching local index or configure
its URL to use existing remote data.
Remove `.env.development.local` to return to the usual development configuration.

Run frontend behavior checks with `npm test`; run builder checks from the repository
root with `python -m unittest discover -s scripts/tests -v`.

## Expected Public Assets

The app expects generated assets in this shape:

```text
public/
  tiles/
    sword_tile_manifest.json
    reach_search_index.json
    *_reaches_*.pmtiles
    *_reaches.colors.json
    global_rivers_natural_earth.pmtiles
  nodes/
    hbXX/
      {reach_id}.json
```

See the root `README.md` for the full asset-generation workflow from SWORD
reach and node GeoPackages.

## Build

```bash
npm run build
```

The deployable static site is written to `dist/`.
