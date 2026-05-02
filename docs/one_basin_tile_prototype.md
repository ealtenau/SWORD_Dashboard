# One-Basin PMTiles Prototype

The next implementation step is to generate a PMTiles archive for one SWORD
basin and connect it to the React map.

## 1. Install Tippecanoe

On macOS with Homebrew:

```bash
brew install tippecanoe
```

Check:

```bash
tippecanoe --version
```

## 2. Pick One Reach Source File

Use one basin-level SWORD reach vector file, such as:

```text
hb74_reaches.shp
hb74_reaches.gpkg
hb74_reaches.fgb
```

The file should include a `reach_id` column and the attributes used by the
frontend layer modes, such as `width`, `wse`, `facc`, `dist_out`, `slope`, and
`swot_obs`.

## 3. Build PMTiles

From the repo root:

```bash
python scripts/build_reach_pmtiles.py /path/to/hbXX_reaches.shp \
  --output frontend/public/tiles/hbXX_reaches.pmtiles \
  --layer reaches
```

Run this from the repository root. If it is run from inside `scripts/`, the same
relative output path will create `scripts/frontend/public/tiles/...`, which Vite
does not serve.

The script:

- reads the reach vector file with GeoPandas
- reprojects to EPSG:4326
- keeps only web-map attributes
- writes temporary GeoJSONL
- calls Tippecanoe
- outputs a `.pmtiles` archive
- outputs a companion `.colors.json` metadata file with per-source color bins

## 4. Point React at the Archive

Create `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

Set:

```text
VITE_SWORD_REACHES_PMTILES=/tiles/hbXX_reaches.pmtiles
VITE_SWORD_REACHES_SOURCE_LAYER=reaches
VITE_SWORD_COLOR_BINS_JSON=/tiles/hbXX_reaches.colors.json
```

Then restart the Vite dev server:

```bash
cd frontend
npm run dev
```

## 5. Verify

Expected behavior:

- reach lines render on the map
- layer mode buttons recolor the same reach source
- hovering a reach populates the inspector
- clicking a reach locks the selected reach in the inspector
- the selected reach is highlighted

## 6. Next After This Works

Once the one-basin PMTiles map works, export node data for the same basin and
replace the chart placeholders with real node-level plots.

## Node Profile JSON

The React charts load static JSON profiles from:

```text
frontend/public/nodes/hbXX/{reach_id}.json
```

Export profiles from the existing SWORD node NetCDF files:

```bash
python scripts/build_node_profiles.py data/nodes_hb51.nc data/nodes_hb52.nc \
  data/nodes_hb53.nc data/nodes_hb55.nc data/nodes_hb56.nc data/nodes_hb57.nc \
  --output-dir frontend/public/nodes
```

For all node files:

```bash
python scripts/build_node_profiles.py data/nodes_hb*.nc \
  --output-dir frontend/public/nodes
```

This script requires `netCDF4`, so run it from the SWORD Python environment.
The generated node JSON files are ignored by git.

## Improving Zoomed-In Resolution

If reaches look too simplified when zooming in, rebuild the PMTiles archive from
the least-simplified SWORD reach source available. The frontend cannot recover
detail that was already removed before tiling.

For a higher-detail Oceania test:

```bash
python scripts/build_reach_pmtiles.py /path/to/oc_reaches.gpkg \
  --output frontend/public/tiles/oc_reaches.pmtiles \
  --layer reaches \
  --maxzoom 16 \
  --full-detail 14 \
  --low-detail 11 \
  --simplification 0.5
```

If that is still too simplified and the output file size is acceptable, try the
most geometry-preserving option:

```bash
python scripts/build_reach_pmtiles.py /path/to/oc_reaches.gpkg \
  --output frontend/public/tiles/oc_reaches.pmtiles \
  --layer reaches \
  --maxzoom 16 \
  --full-detail 14 \
  --low-detail 11 \
  --simplification 0.5 \
  --no-simplify-maxzoom
```

Tradeoffs:

- Higher `--maxzoom` improves detail while zooming in, but creates more tiles.
- Higher `--full-detail` preserves more coordinate precision at max zoom.
- Lower `--simplification` keeps more shape detail.
- `--no-simplify-maxzoom` can make tiles much larger, so use it after testing the
  lighter settings first.

## Per-Basin or Per-Continent Symbology

`scripts/build_reach_pmtiles.py` now writes color metadata next to the PMTiles
archive by default. For example:

```text
frontend/public/tiles/oc_reaches.pmtiles
frontend/public/tiles/oc_reaches.colors.json
```

The metadata is computed from the same source reach file used for tiling:

- WSE: quantile bins with the old `terrain` ramp.
- Width: quantile bins with the old `viridis` ramp.
- Flow accumulation: quantile bins with the old reversed `Spectral` ramp.
- Distance from outlet: quantile bins with the old `plasma` ramp.
- Slope: quantile bins with the old `hot` ramp.
- SWOT observations: fixed bins with the old `gnuplot2` ramp.

To override the metadata path, pass:

```bash
python scripts/build_reach_pmtiles.py /path/to/oc_reaches.gpkg \
  --output frontend/public/tiles/oc_reaches.pmtiles \
  --color-metadata-output frontend/public/tiles/oc_reaches.colors.json
```

If `VITE_SWORD_COLOR_BINS_JSON` is not set, the frontend tries to derive the
metadata URL from the PMTiles URL by replacing `.pmtiles` with `.colors.json`.

## Large Continent Tiling

For dense continents, low-zoom tiles may exceed Tippecanoe's default tile-size
limit. Start by raising the minimum zoom and relaxing low-zoom detail:

```bash
python scripts/build_reach_pmtiles.py /path/to/as_reaches.gpkg \
  --output frontend/public/tiles/as_reaches.pmtiles \
  --layer reaches \
  --minzoom 4 \
  --maxzoom 16 \
  --full-detail 14 \
  --low-detail 9 \
  --simplification 1.0 \
  --drop-densest-as-needed
```

If that still fails, try `--minzoom 5`. Avoid `--no-tile-size-limit` for final
tiles unless browser testing shows the oversized low-zoom tiles are acceptable.

For the long-term global view, consider a separate generalized low-zoom overview
archive plus detailed continent archives.

## Global Overview Layer

To keep rivers visible at global zooms, build a simplified overview archive from
all continent reach files:

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

This writes:

```text
frontend/public/tiles/global_reaches_overview.pmtiles
frontend/public/tiles/global_reaches_overview.colors.json
```

Then set:

```text
VITE_SWORD_OVERVIEW_PMTILES=/tiles/global_reaches_overview.pmtiles
VITE_SWORD_OVERVIEW_COLOR_BINS_JSON=/tiles/global_reaches_overview.colors.json
VITE_SWORD_OVERVIEW_MAX_ZOOM=5
VITE_SWORD_DETAIL_MIN_ZOOM=4
```

The overview layer uses global color bins and is visible at low zooms. Detailed
continent layers take over from `VITE_SWORD_DETAIL_MIN_ZOOM` upward.

If the overview looks too sparse, lower `--min-facc` or omit it. If it looks too
dense, raise `--min-facc`. If it still looks broken up, increase
`--snap-tolerance-meters` carefully, for example 250 or 500. The connected
overview is intentionally cartographic and should not be used for reach-level
clicks.

## Showing Multiple Continents

The React frontend can load one PMTiles source per continent. Use these expected
local filenames:

```text
frontend/public/tiles/af_reaches.pmtiles
frontend/public/tiles/af_reaches.colors.json
frontend/public/tiles/as_reaches.pmtiles
frontend/public/tiles/as_reaches.colors.json
frontend/public/tiles/eu_reaches.pmtiles
frontend/public/tiles/eu_reaches.colors.json
frontend/public/tiles/na_reaches.pmtiles
frontend/public/tiles/na_reaches.colors.json
frontend/public/tiles/oc_reaches.pmtiles
frontend/public/tiles/oc_reaches.colors.json
frontend/public/tiles/sa_reaches.pmtiles
frontend/public/tiles/sa_reaches.colors.json
```

For local Oceania-only testing:

```text
VITE_SWORD_CONTINENTS=oc
```

For all continents:

```text
VITE_SWORD_CONTINENTS=af,as,eu,na,oc,sa
```

or:

```text
VITE_SWORD_CONTINENTS=all
```

When multiple continents are visible, each continent uses its own color-bin
metadata. The legend follows the selected or hovered continent; otherwise it
shows that local continent scales are active.
