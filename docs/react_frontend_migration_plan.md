# SWORD Explorer React Frontend Migration Plan

## Goal

Move the SWORD Explorer from a Dash-first interface with embedded Folium HTML
maps to a React-first geospatial application. Keep Python where it is strongest:
SWORD preprocessing, tile generation, node-attribute preparation, and any
server-side reporting or analysis workflows.

The target user experience is a persistent, responsive map application with
direct feature picking, dynamic layer styling, selected-reach state, and fast
node-level charts.

## Recommended Architecture

Use a static-capable React frontend with geospatial data served as static assets:

- **Frontend:** React with Vite.
- **Map:** MapLibre GL JS.
- **Map data:** PMTiles vector tile archives generated from SWORD reaches/basins.
- **Charts:** Plotly.js, Observable Plot, or ECharts in React.
- **Node data:** partitioned Parquet, DuckDB-WASM, JSON chunks, or a small API.
- **Optional backend:** FastAPI for reporting, server-side node lookup, or
  authenticated/admin workflows.

Dash can remain as the legacy application during migration, but the new map UI
should not depend on Dash callbacks or Folium iframes.

## Why React Helps

React is a better fit for the next SWORD Explorer UI because the core problems
are frontend state and interaction problems:

- Keep one persistent map instance instead of swapping full HTML map files.
- Handle basin/reach click events directly from MapLibre.
- Highlight selected reaches and hovered reaches without regenerating maps.
- Make layer modes, legends, filters, and search ordinary UI state.
- Encode selected basin, reach, layer mode, and map camera in the URL.
- Build responsive sidebars, inspectors, and chart panels around the map.
- Load map tiles, node tables, and chart data asynchronously.

Dash is still useful for Python-native plotting, but it becomes awkward when the
map needs rich browser-side behavior.

## Proposed Repository Layout

Keep the current Dash app in place while adding a new frontend:

```text
SWORD_Dashboard/
  app.py                         # existing Dash app, kept during migration
  assets/                        # existing generation scripts and images
  data/                          # current generated local data
  docs/
    geospatial_refactor_plan.md
    react_frontend_migration_plan.md
  frontend/
    package.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      components/
        MapView.tsx
        LayerPanel.tsx
        FeatureInspector.tsx
        ReachCharts.tsx
        SearchBox.tsx
      map/
        sources.ts
        layers.ts
        styles.ts
        interactions.ts
      data/
        nodeData.ts
        reachQueries.ts
      state/
        explorerStore.ts
      styles/
        app.css
  scripts/
    build_tiles.py
    build_node_tables.py
```

If the Python generation scripts stay under `assets/`, the `scripts/` directory
can be skipped. The important boundary is that React consumes generated web
assets, while Python produces them.

## Frontend State Model

Centralize explorer state so the map, panels, and charts stay synchronized:

- `continent`
- `selectedBasin`
- `selectedReachId`
- `hoveredReachId`
- `activeLayerMode`
- `mapCamera`
- `visibleBasemap`
- `filters`
- `selectedReachProperties`
- `nodeSeries`

Use lightweight state management first. React state plus context may be enough.
If state grows, use Zustand because it is small and fits map-heavy apps well.

## Map Interaction Model

MapLibre should own map rendering and feature interaction:

- On basin click, set `selectedBasin`, fly to its bounds, and reveal reach layers.
- On reach hover, show tooltip and update hover highlight.
- On reach click, set `selectedReachId`, highlight the reach, and load node data.
- On layer mode change, update MapLibre paint expressions for color and width.
- On map movement, update URL state after a debounce.
- On search by `reach_id`, fly to the matching reach and select it.

Do not generate one HTML map per basin. Use one map with data-driven sources,
filters, and style expressions.

## Data Delivery Plan

Use three classes of generated assets:

1. **Basin vector tiles**
   - Low zooms.
   - Used for continent overview and basin selection.
   - Includes `Basin`/`PFAF_ID` and display labels.

2. **Reach vector tiles**
   - Mid/high zooms.
   - Includes reach attributes needed for styling, tooltip, and click.
   - Does not include full node profiles.

3. **Node attribute tables**
   - Loaded only after reach selection.
   - Start simple with JSON chunks partitioned by basin if Parquet lookup is not
     ready.
   - Move to Parquet or DuckDB-WASM once the frontend prototype works.

4. **Reach search index**
   - Static JSON used by the React search box.
   - Includes `reach_id`, `river_name`, centroid coordinates, optional continent
     ID, and reach bounding boxes.
   - Lets the app zoom to exact Reach IDs or to the combined extent of reaches
     matching a river name without requiring a live database.

### Split Reach PMTiles Workflow

Large continent reach files can be split into spatial subsets before PMTiles
generation. This keeps each archive near the target feature count while the
frontend still treats the pieces as one logical continent.

```bash
python scripts/split_continent_reaches.py \
  /path/to/af_sword_reaches_v17b.gpkg \
  /path/to/as_sword_reaches_v17b.gpkg \
  /path/to/eu_sword_reaches_v17b.gpkg \
  /path/to/na_sword_reaches_v17b.gpkg \
  /path/to/oc_sword_reaches_v17b.gpkg \
  /path/to/sa_sword_reaches_v17b.gpkg \
  --max-reaches 20000
```

The script writes split GeoPackages to `external_data/sword_split_reaches/`,
a tile manifest to `frontend/public/tiles/sword_tile_manifest.json`, and a helper
build script at `scripts/build_split_pmtiles.sh`. After running the generated
build script, enable the manifest in `frontend/.env`:

```text
VITE_SWORD_TILE_MANIFEST_JSON=/tiles/sword_tile_manifest.json
VITE_SWORD_CONTINENTS=all
```

Node profile JSON does not need to be split the same way as the PMTiles. The app
loads node charts by `reach_id`, so the existing basin/reach-prefix node
partitioning can continue to serve reaches selected from any PMTiles subset.

Build the static reach search index from the same reach GeoPackages used for
tile generation:

```bash
python scripts/build_reach_search_index.py \
  external_data/sword_split_reaches/*.gpkg \
  --output frontend/public/tiles/reach_search_index.json
```

When hosted separately from the app shell, point the frontend at the deployed
index:

```text
VITE_SWORD_REACH_SEARCH_INDEX_JSON=https://static.sword.example.org/tiles/reach_search_index.json
```

## Backend Options

### Option A: Fully Static

Best if free hosting and low maintenance are the top priorities.

- React app hosted on Cloudflare Pages, GitHub Pages, or similar.
- PMTiles served from static/object storage with CORS and Range Requests.
- Node data served as static Parquet or JSON chunks.
- Reporting uses a form service, GitHub issue template, or serverless endpoint.

### Option B: React + FastAPI

Best if reporting, node lookup, or data validation needs Python server logic.

- React frontend is static.
- FastAPI serves `/reach/{reach_id}/nodes`, report submission, and metadata.
- PMTiles still served from static/object storage.
- Backend can be deployed separately on Render, Fly.io, university hosting, or
  another low-cost service.

### Option C: React Embedded Beside Dash

Best for a low-risk transition.

- Build the React map as a standalone frontend first.
- Keep the Dash app available as the production app.
- Optionally embed the React build in Dash temporarily.
- Retire Dash map views once feature parity is reached.

Recommended path: start with Option C, then decide between Option A and Option B
after the first basin prototype proves the data workflow.

## Deployment and Hosting Plan

Preferred low-cost hosting target: **Cloudflare Pages + Cloudflare R2**.

The React app can be built as static files, but the generated data assets are
too large and numerous for most free static-site hosts. The current prototype
has multi-GB PMTiles/node assets and hundreds of thousands of node JSON files, so
the app shell and data assets should be hosted separately.

Recommended deployment shape:

1. **Cloudflare Pages** hosts the Vite React build output from `frontend/dist`.
2. **Cloudflare R2** hosts generated static data assets:
   - `frontend/public/tiles/*.pmtiles`
   - `frontend/public/tiles/*.colors.json`
   - `frontend/public/tiles/sword_tile_manifest.json`
   - `frontend/public/nodes/**` if node JSON remains the deployed format
3. Expose the R2 bucket through a public/custom static asset domain, for example
   `https://static.sword.example.org`.
4. Configure CORS and public access so MapLibre/PMTiles and node JSON fetches
   work from the Pages domain.
5. Point frontend environment/config URLs at the R2-hosted assets instead of
   same-origin `/tiles` and `/nodes` paths.

Likely environment/config updates:

```text
VITE_SWORD_TILE_MANIFEST_JSON=https://static.sword.example.org/tiles/sword_tile_manifest.json
VITE_SWORD_OVERVIEW_PMTILES=https://static.sword.example.org/tiles/global_rivers_natural_earth.pmtiles
VITE_SWORD_NODE_BASE_URL=https://static.sword.example.org/nodes
VITE_SWORD_REACH_SEARCH_INDEX_JSON=https://static.sword.example.org/tiles/reach_search_index.json
```

Implementation notes:

- Keep code and lightweight config in GitHub.
- Avoid committing generated multi-GB `frontend/public/tiles` and
  `frontend/public/nodes` assets long-term once R2 hosting is in place.
- Use hashed or versioned asset prefixes when publishing new SWORD releases, for
  example `/v17b/tiles/...` and `/v17b/nodes/...`.
- Keep the local `frontend/public` layout as the developer/test layout; mirror
  that layout into R2 for production.
- If node JSON file count becomes painful to upload/manage, replace per-reach
  JSON with coarser basin JSON, Parquet, DuckDB-WASM, or a small lookup API.

Why not GitHub Pages as the final host:

- GitHub Pages is simple and free for small static apps, but published sites have
  a 1 GB size limit and a soft bandwidth limit.
- The current generated assets exceed that shape even before future full-dataset
  growth.

Why not put everything directly on Cloudflare Pages:

- Cloudflare Pages is a good fit for the app shell, but it has file-count and
  per-file size limits that do not fit the full generated tile/node asset set.
- R2 is the better place for large static geospatial assets and node data.

## Migration Phases

### Phase 0: Baseline

- Document current map behavior and required feature parity.
- Pick one representative heavy basin for the prototype.
- Identify the source reach files used to generate the current `hbXX_sword_map.html`.

Exit criteria:

- One basin selected.
- Current load time, map size, and interaction behavior recorded.

### Phase 1: React Skeleton

- Create `frontend/` with Vite, React, TypeScript, and MapLibre GL JS.
- Build the main application shell: full map, header, layer panel, inspector, and
  chart panel.
- Add a public basemap style.

Exit criteria:

- Local React app runs.
- Map displays and resizes correctly on desktop and mobile widths.

### Phase 2: One-Basin Vector Tile Prototype

- Generate PMTiles for one basin's reaches.
- Add the PMTiles protocol/source to MapLibre.
- Render reaches with one attribute layer mode, such as width.
- Add hover tooltip and selected-reach highlight.

Exit criteria:

- Reaches render faster than the current Folium HTML for the same basin.
- Clicked reach ID is visible in the inspector.
- Styling changes without reloading the map.

### Phase 3: Node Charts

- Export node data for the prototype basin to a frontend-friendly format.
- Load node series when a reach is clicked.
- Rebuild the existing six node-level plots in React.

Exit criteria:

- Clicking a reach updates node charts.
- The chart values match the current Dash `plot_nodes` output for sample reaches.

### Phase 4: Basin Overview

- Generate basin PMTiles.
- Add continent/basin selection and fly-to-bounds behavior.
- Replace continent tabs with a map-aware selector or sidebar controls.

Exit criteria:

- User can start from continent scale, click a basin, and inspect reaches.
- URL state can restore selected basin and map camera.

### Phase 5: Full Dataset

- Generate global basin and reach PMTiles.
- Partition node data by basin or reach prefix.
- Add loading states, error states, and fallback messages.
- Compare geometry fidelity against the original SWORD reach geometries.

Exit criteria:

- All current continents and basins are covered.
- Large basins remain usable.
- Tile and node assets can be hosted outside the app server.

### Phase 6: Feature Parity and Enhancements

- Add layer modes for WSE, width, flow accumulation, distance from outlet, slope,
  and SWOT observations.
- Add reach search.
- Add selected-basin breadcrumbs.
- Add report-reach workflow.
- Add shareable URLs.
- Add optional multi-select summaries.

Exit criteria:

- New React app can replace the public explorer map experience.
- Dash is needed only for legacy/admin workflows, or not needed at all.

## First Implementation Slice

The smallest useful build is:

1. Create `frontend/` with React, Vite, TypeScript, and MapLibre.
2. Build a full-page map with a layer panel and feature inspector.
3. Generate one PMTiles reach archive for a single basin.
4. Render the reach layer with dynamic width coloring.
5. On reach click, show `reach_id` and key attributes in the inspector.
6. Load node data for that reach and render the six existing node charts.

This proves the core replacement for the current iframe/postMessage pattern
without forcing an immediate rewrite of the whole dashboard.

## Implementation Status

Started:

- Added `frontend/` React/Vite scaffold.
- Added a persistent MapLibre map shell.
- Added layer mode controls for SWORD reach attributes.
- Added PMTiles wiring via `VITE_SWORD_REACHES_PMTILES`.
- Added hover/click plumbing for reach vector tile features.
- Added selected-reach inspector and node chart placeholders.
- Added React layer symbology based on the old Folium map colormaps in
  `assets/sword_maps_click.py`.
- Added per-source color-bin metadata generation and frontend loading for
  basin/continent-specific symbology.
- Added Option B multi-continent PMTiles configuration. The React map can load
  one source/layer pair per enabled continent.
- Added static node-profile JSON export and React node charts for selected
  reaches.
- Added optional low-zoom global overview PMTiles layer for world-scale patterns.
- Refactored the interaction model so the global overview is a neutral
  orientation layer and all enabled detailed continent layers become visible at
  detail zooms.

Next:

- Install Node.js and frontend dependencies.
- Run the React dev server.
- Generate one basin PMTiles archive using `scripts/build_reach_pmtiles.py`.
- Connect the prototype PMTiles archive through `.env`.
- Generate the remaining continent PMTiles archives and set
  `VITE_SWORD_CONTINENTS=af,as,eu,na,oc,sa` or `VITE_SWORD_CONTINENTS=all`.
- Generate node-profile JSON for all deployed continents.
- Generate `frontend/public/tiles/reach_search_index.json` for Reach ID and
  river-name search.
- Build `global_reaches_overview.pmtiles` after all continent reach sources are
  ready, then tune the overview/detail zoom crossover.
- Prepare a Cloudflare Pages + R2 deployment path for the React build and
  generated static assets.

## Technical Risks

- PMTiles hosting must support HTTP Range Requests and CORS.
- Very large global archives may need splitting by continent or basin.
- Static hosting plans usually have file-count, file-size, or bandwidth limits;
  keep generated PMTiles/node assets in object storage rather than the app host.
- High-detail reach geometry may require tuning Tippecanoe simplification and
  max zoom settings.
- Client-side Parquet lookup may be heavier than JSON chunks for the first
  prototype.
- Report submission may require a backend or serverless endpoint.

## Decision Points

Resolve these after the first basin prototype:

- Fully static app or React + FastAPI?
- One global PMTiles archive or split archives by continent/basin?
- Plotly.js, Observable Plot, or ECharts for node charts?
- JSON chunks first, or direct Parquet/DuckDB-WASM?
- Keep Dash as an internal tool, or retire it completely?
