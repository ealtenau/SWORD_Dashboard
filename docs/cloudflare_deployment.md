# Cloudflare Pages + R2 Deployment

This guide deploys the React app to Cloudflare Pages and the generated SWORD
assets to Cloudflare R2.

## Deployment Shape

```text
Cloudflare Pages
  React app from frontend/dist

Cloudflare R2
  tiles/
  nodes/
```

The app is built without bundling local generated assets. In production, it
loads PMTiles, color metadata, the search index, and node profile JSON from R2.

## 1. Create An R2 Bucket

In Cloudflare:

1. Go to **R2 Object Storage**.
2. Create a bucket, for example `sword-explorer-assets`.
3. In the bucket settings, enable either:
   - a public `r2.dev` development URL for initial testing, or
   - a custom domain for a longer-term public deployment.

Use the public URL as `R2_PUBLIC_URL` below.

## 2. Upload Generated Assets To R2

The generated assets are too large for Pages and should be uploaded to R2:

```bash
frontend/public/tiles/
frontend/public/nodes/
```

For this project, `rclone` is the most practical upload tool because the node
profiles contain many small JSON files.

After configuring an R2 remote named `r2`, upload with:

```bash
rclone copy frontend/public/tiles r2:sword-explorer-assets/tiles --progress
rclone copy frontend/public/nodes r2:sword-explorer-assets/nodes --progress
```

Check a few expected files:

```bash
rclone ls r2:sword-explorer-assets/tiles | head
rclone ls r2:sword-explorer-assets/nodes | head
```

## 3. Configure R2 CORS

Add a CORS policy on the R2 bucket so the Pages app can read assets in the
browser.

For initial testing, use your Pages URL and localhost:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://YOUR_PROJECT.pages.dev"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

After adding a custom domain for Pages, add that domain to `AllowedOrigins`.

## 4. Create A Cloudflare Pages Project

In Cloudflare:

1. Go to **Workers & Pages**.
2. Select **Create application**.
3. Choose **Pages** and connect the GitHub repository.
4. Use these build settings:

```text
Framework preset: Vite
Root directory: frontend
Build command: npm run build:cloudflare
Build output directory: dist
```

The `frontend/.node-version` file pins the Pages build to Node 22.16.0.

## 5. Set Pages Environment Variables

In the Pages project settings, add these production environment variables:

```text
VITE_SWORD_REACHES_SOURCE_LAYER=reaches
VITE_SWORD_CONTINENTS=all
VITE_SWORD_TILE_MANIFEST_JSON=R2_PUBLIC_URL/tiles/sword_tile_manifest.json
VITE_SWORD_NODE_BASE_URL=R2_PUBLIC_URL/nodes
VITE_SWORD_REACH_SEARCH_INDEX_JSON=R2_PUBLIC_URL/tiles/reach_search_index.json
VITE_SWORD_OVERVIEW_PMTILES=R2_PUBLIC_URL/tiles/global_rivers_natural_earth.pmtiles
VITE_SWORD_OVERVIEW_SOURCE_LAYER=rivers
VITE_SWORD_OVERVIEW_MAX_ZOOM=5
VITE_SWORD_DETAIL_MIN_ZOOM=4
VITE_MAP_CENTER_LON=10
VITE_MAP_CENTER_LAT=15
VITE_MAP_ZOOM=1.6
```

Replace `R2_PUBLIC_URL` with the public bucket URL, without a trailing slash.

## 6. Deploy And Test

After the first Pages deploy, open the `*.pages.dev` URL and check:

- the app shell loads
- the favicon appears
- the global overview layer appears
- search suggestions load
- selecting a reach loads node charts

If map assets fail to load, check the browser Network tab. The most likely
issues are an incorrect R2 URL or missing CORS origin.

## Local Development After Deployment

Keep using Vite locally for app development:

```bash
cd frontend
npm run dev
```

The safest post-deployment local setup is to point local dev at the same R2
asset URLs as production. This avoids needing a full local copy of every large
PMTiles and node profile file, and it does not affect the deployed app because
Cloudflare Pages uses the environment variables configured in Pages settings.

Create a private local env file from the R2 template:

```bash
cp .env.local.example .env.local
```

Then replace `R2_PUBLIC_URL` in `.env.local` with the public bucket URL, without
a trailing slash. Vite loads `.env.local` for local dev, while the file stays
uncommitted.

If local zoomed-in reach tiles do not appear, check:

- `frontend/.env.local` has `VITE_SWORD_TILE_MANIFEST_JSON` pointing to the R2
  `sword_tile_manifest.json`.
- The manifest's `pmtilesUrl` paths resolve to real R2 objects.
- The R2 CORS policy includes `http://localhost:5173`.
- After changing env files, restart `npm run dev`; Vite reads env variables at
  server startup.

To test locally generated assets instead, use same-origin paths in
`frontend/.env.local`:

```text
VITE_SWORD_TILE_MANIFEST_JSON=/tiles/sword_tile_manifest.json
VITE_SWORD_NODE_BASE_URL=/nodes
VITE_SWORD_REACH_SEARCH_INDEX_JSON=/tiles/reach_search_index.json
VITE_SWORD_OVERVIEW_PMTILES=/tiles/global_rivers_natural_earth.pmtiles
```

## Useful Commands

Build the deployable app locally without copying local generated data:

```bash
cd frontend
npm run build:cloudflare
```

Preview the built shell:

```bash
npm run preview
```
