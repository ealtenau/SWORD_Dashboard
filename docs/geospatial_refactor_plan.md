# SWORD Explorer Geospatial Refactor Plan

## Current Architecture

The dashboard currently renders prebuilt Folium maps as HTML iframes from `data/`.
Feature clicks are sent back to Dash through `window.postMessage` and stored in
`dcc.Store`. This works, but it makes map behavior hard to extend because the
map is effectively a separate static document.

Key constraints observed in the current app:

- `app.py` loads every `nodes_*.nc` file into one Pandas DataFrame at startup.
- Continent and basin maps are generated ahead of time as static HTML files.
- Basin click events swap the iframe `srcDoc` to another generated HTML file.
- Reach click events update the Plotly node-attribute graph.
- The local `data/` directory is about 2.8 GB and contains many generated maps.

## Recommended Stack

Use a vector-tile-first architecture:

- **Map renderer:** MapLibre GL JS.
- **SWORD reach/basin delivery:** PMTiles or hosted MVT vector tiles.
- **Tile generation:** Tippecanoe from GeoPackage, FlatGeobuf, or GeoJSON/GeoJSONL.
- **Dash integration:** Keep Dash for Python callbacks and Plotly node graphs, but
  replace Folium iframes with a Dash component or a small custom MapLibre wrapper.
- **Optional analytics layer:** DuckDB/Parquet for node lookup and lightweight
  attribute queries.

Why this stack fits SWORD:

- MapLibre GL JS is open source, browser-native, and GPU accelerated.
- PMTiles packages a full tile pyramid into one static file that can be served
  from ordinary static storage using HTTP Range Requests.
- Tippecanoe supports zoom-specific simplification and high-detail vector tile
  generation, which directly addresses the current "simplified for map
  efficiency" limitation.

## Data Model

Create separate tile archives by scale and purpose:

- `sword_basins.pmtiles`: basin polygons and labels, low zooms.
- `sword_reaches_z0_z8.pmtiles`: generalized reaches for continent/basin context.
- `sword_reaches_z9_z14.pmtiles`: high-detail reaches for basin exploration.
- `sword_nodes.parquet`: node attributes keyed by `reach_id` and `node_id`.

Each reach tile should include only properties needed for styling and picking:

- `reach_id`
- `river_name`
- `wse`
- `width`
- `facc`
- `dist_out`
- `slope`
- `swot_obs`
- upstream/downstream IDs if still needed in tooltips

Keep full node-level series out of vector tiles. Load them on demand after a
reach click from Parquet or an API endpoint.

## Interaction Model

Replace iframe messaging with direct map events:

- Basin click: filter or fly to the basin, then show reach layers.
- Reach click: emit `reach_id` to Dash and update the node graph.
- Hover: show a lightweight tooltip from vector tile feature properties.
- Box/lasso select: query rendered features and summarize selected reaches.
- Layer controls: switch style expressions instead of swapping full HTML files.
- URL state: encode selected basin/reach/layer in query params for shareable views.

MapLibre can style the same vector source dynamically, so WSE, width, slope,
flow accumulation, and SWOT observations can be layer modes rather than separate
pre-rendered maps.

## Dynamic Resolution

Use zoom-dependent tile detail and style expressions:

- Low zooms: generalized river network, thinner lines, fewer labels.
- Mid zooms: basin-level reach geometry, hover/click enabled.
- High zooms: high-detail reach geometry with larger hit targets.
- Overzooming: allow high-detail tiles to remain readable beyond max tile zoom.

Tippecanoe options to evaluate:

- `--maximum-zoom` / `--minimum-zoom` for tile pyramid limits.
- `--simplify-only-low-zooms` to preserve max-zoom geometry.
- `--no-line-simplification` only for a high-detail test archive.
- `--extra-detail` if line precision is visibly degraded at high zoom.
- `--drop-densest-as-needed` only if tile sizes get too large.

## Free/Open Hosting Options

Best free-static path:

- Host Dash app separately if Python callbacks remain required.
- Host PMTiles and static assets on a service that supports HTTP Range Requests
  and CORS. Cloudflare R2/Pages, GitHub Pages for smaller artifacts, or public
  object storage are the natural candidates.

If the app can become fully static:

- Use a static frontend with MapLibre and PMTiles.
- Store node data as partitioned Parquet or small JSON chunks by basin/reach.
- Host the whole explorer on GitHub Pages, Cloudflare Pages, or similar.

If Dash stays central:

- Keep Dash callbacks for node graphs, reporting, and server-side data lookup.
- Serve PMTiles from object/static storage, not from the Dash process.
- Consider Render, Fly.io, Hugging Face Spaces, or university infrastructure for
  the Dash service, depending on uptime and data policy.

## Migration Plan

1. **Prototype one basin.**
   Convert one representative basin reach layer to PMTiles and build a MapLibre
   proof of concept with hover, click, and style switching.

2. **Bridge MapLibre to Dash.**
   Add a small JS component that sends selected `reach_id` into `dcc.Store`, then
   reuse the existing `plot_nodes` callback.

3. **Move node data to lazy lookup.**
   Replace startup loading of all `nodes_*.nc` files with basin/reach lookup from
   Parquet, DuckDB, or cached NetCDF reads.

4. **Generate global tiles.**
   Build basin and reach PMTiles archives for all continents. Compare tile sizes,
   render performance, and geometry quality against current Folium HTML outputs.

5. **Replace iframe maps.**
   Remove generated HTML map swapping and use one persistent map instance with
   vector sources, style modes, and click handlers.

6. **Deploy static geospatial assets.**
   Upload PMTiles and basemap/style assets to static storage with Range Request
   support and CORS enabled.

7. **Polish workflows.**
   Add selected-reach highlighting, selected-basin breadcrumbs, search by
   `reach_id`, shareable URLs, and optional multi-reach selection summaries.

## Suggested First Implementation Slice

Start with North America or one known heavy basin. The minimum useful prototype:

- Generate `hbXX_reaches.pmtiles` from the existing reach source.
- Add a MapLibre map page/component next to the current app, not replacing it yet.
- On reach click, update the existing `ReachGraph`.
- Implement one layer mode, such as `width`, with zoom-dependent line width.

This gives a measurable before/after comparison without risking the current
production workflow.

## References

- MapLibre GL JS: https://maplibre.org/projects/gl-js/
- MapLibre vector sources: https://maplibre.org/maplibre-gl-js/docs/API/classes/VectorTileSource/
- PMTiles concepts: https://docs.protomaps.com/pmtiles/
- Tippecanoe options: https://github.com/felt/tippecanoe
- deck.gl GeoJsonLayer, useful if GPU-rendered analytical overlays are needed:
  https://deck.gl/docs/api-reference/layers/geojson-layer
