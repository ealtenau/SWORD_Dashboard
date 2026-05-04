# Legacy Dash/Folium App

This folder archives the pre-React SWORD Explorer implementation.

Current development now lives in:

```text
frontend/   # React + Vite + MapLibre application
scripts/    # static asset generation from SWORD GeoPackages
```

The files here are kept for reference and reproducibility, especially for older
map behavior, hover/click fields, report workflows, and Folium HTML generation.

## Contents

```text
app.py              # original click-driven Dash app
app_no_click.py     # Dash app variant with dropdown-driven basin selection
assets/             # legacy Folium map builders, Dash clientside JS, NetCDF formatter
```

The root `assets/` folder now contains shared image files used by the React app.
Legacy Python and JavaScript helpers that were previously in root `assets/`
have been moved here.

## Legacy Data Assumptions

These scripts still assume the old app layout:

```text
data/
  *_basin_map.html
  hbXX_sword_map.html
  nodes_hbXX.nc
about.md
download.md
user_reports.csv
```

Some generation scripts also contain historical local absolute paths. Treat them
as archived references unless you intentionally update paths for a one-off run.

## Running For Reference

From the repository root, the old apps can be launched with:

```bash
python legacy/dash_folium/app.py
```

or:

```bash
python legacy/dash_folium/app_no_click.py
```

They require the legacy Python dependencies and the old `data/` assets. The
React app does not depend on this folder.
