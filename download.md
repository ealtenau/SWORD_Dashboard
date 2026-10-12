# SWORD: the SWOT River Database

### Version 17c

SWORD was developed by the SWOT Science Team to serve as the foundation for SWOT river data products. It is based on a variety of datasets, including the Global River Widths from Landsat (GRWL) database, MERIT Hydro, and the Global River Obstruction Database (GROD). It consists of a series of river nodes (~200 m spacing) and reaches (~10 km long) for which SWOT data is provided. If you would like more information about SWORD, please see [Altenau et al. (2021)] (https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2021WR030054) for initial database development and the [SWORD GitHub Page](https://github.com/SWORD-Global/SWORD) for the latest database updates.

SWORD is managed by the [Global Hydrology Lab] (https://uncglobalhydrology.org/) at the University of North Carolina at Chapel Hill. If you have questions, feel free to email Tamlin Pavelsky _(pavelsky@unc.edu)_.

**Version Notes:**
v17c preserves the topology and reach/node definitions of v17b and adds observation-based and routing variables:
- SWOT observation statistics — per-reach and per-node distributions (percentiles, range, MAD) of water surface elevation, width, and slope derived from actual SWOT passes.
- Mainstem routing — mainstem identification (is_mainstem, main_path_id) and main upstream/downstream neighbor selection (rch_id_up_main, rch_id_dn_main).
- Hydrological distances — Dijkstra shortest-path and mainstem distances to outlet (dist_out_dijkstra, hydro_dist_out) and width-prioritized headwater/outlet endpoints (best_headwater, best_outlet).
- Corrected flow accumulation — denoised facc at 95,880 reaches (38.6%) where inherited values were physically inconsistent.
All original v17b variables are retained. See the [release notes] (https://github.com/SWORD-Global/SWORD/blob/main/docs/v17c_release_notes.pdf) for the full list.

### Download:

SWORD is available in three formats: NetCDF, Geopackage, and Shapefile. Data for the current version, along with versions dating back to v14, are available for download on [Zenodo] (https://zenodo.org/records/22259077).