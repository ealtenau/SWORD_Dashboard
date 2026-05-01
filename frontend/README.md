# SWORD Explorer Frontend

React + MapLibre prototype for the next SWORD Explorer interface.

## Local Development

Install Node.js, then run:

```bash
npm install
npm run dev
```

The map shell runs without SWORD tiles. To connect a PMTiles reach archive:

```bash
VITE_SWORD_REACHES_PMTILES=https://example.org/hbXX_reaches.pmtiles npm run dev
```

If the vector tile source layer is not named `reaches`, set:

```bash
VITE_SWORD_REACHES_SOURCE_LAYER=your_layer_name
```

## Current Scope

- Persistent MapLibre map shell.
- Layer mode controls for reach attributes.
- Hover and click wiring for vector tile features.
- Selected-reach inspector.
- Placeholder node chart panel.

Next steps are to generate a one-basin PMTiles archive and connect node data for
the selected reach.

See `../docs/one_basin_tile_prototype.md` for the tile generation workflow.
