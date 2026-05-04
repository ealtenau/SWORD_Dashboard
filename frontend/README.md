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
