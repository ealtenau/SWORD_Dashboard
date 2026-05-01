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

## Technical Risks

- PMTiles hosting must support HTTP Range Requests and CORS.
- Very large global archives may need splitting by continent or basin.
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
