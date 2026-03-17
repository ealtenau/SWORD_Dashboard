# SWORD: the SWOT River Database

### Version 17b

SWORD was developed by the SWOT Science Team to serve as the foundation for SWOT river data products. It is based on a variety of datasets, including the Global River Widths from Landsat (GRWL) database, MERIT-Hydro, and the Global River Obstruction Database (GROD). It consists of a series of river nodes (~200 m spacing) and reaches (~10 km long) for which SWOT data is provided. If you would like more information about SWORD, please see [Altenau et al. (2021)](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2021WR030054).

Before using SWORD, please first read through the [SWORD Product Description Document](https://github.com/ealtenau/SWORD_Dashboard/blob/main/docs/SWORD_ProductDescription_v17b.pdf). SWORD is managed by the [Global Hydrology Lab] (https://uncglobalhydrology.org/) at the University of North Carolina at Chapel Hill. If you have questions, feel free to email Tamlin Pavelsky _(pavelsky@unc.edu)_.

**Version Notes:**
- "Type" change for 1662 reaches and associated nodes globally. This change updates the Reach and Node IDs for impacted reaches and nodes. 
- Updates to reach and node lengths and distance-from-outlet variable to correct a bug in the node length calculation for select reaches (impacted <2% of reaches globally).
- SWORD v17b is the official version for SWOT **Version D** [RiverSP Vector Products](https://podaac.jpl.nasa.gov/SWOT?tab=datasets-information&sections=about). 

### Download:

SWORD is available in three formats: NetCDF, Geopackage, and Shapefile. Data for the current version, along with versions dating back to v14, are available for download on [Zenodo] (https://zenodo.org/records/15299138).