import sys
import tempfile
import unittest
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, Point

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_reach_search_index import infer_continent_id, load_records


class ReachSearchTest(unittest.TestCase):
    def test_v17c_and_split_continent_names(self):
        for id in ("af", "as", "eu", "na", "oc", "sa"):
            self.assertEqual(infer_continent_id(Path(f"sword_{id.upper()}_v17c.gpkg")), id)
            self.assertEqual(infer_continent_id(Path(f"{id}_reaches_001.gpkg")), id)
        self.assertIsNone(infer_continent_id(Path("other.gpkg")))

    def test_combined_geopackage_indexes_reaches_instead_of_nodes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sword_NA_v17c.gpkg"
            gpd.GeoDataFrame({"reach_id": ["71120000113"], "river_name": ["Example"],
                              "geometry": [LineString([(1, 2), (3, 4)])]}, crs="EPSG:4326").to_file(
                                  path, layer="reaches", driver="GPKG")
            gpd.GeoDataFrame({"reach_id": ["71120000113", "71120000113"],
                              "geometry": [Point(1, 2), Point(3, 4)]}, crs="EPSG:4326").to_file(
                                  path, layer="nodes", driver="GPKG")
            records = load_records(path)
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["continent_id"], "na")
            self.assertEqual(records[0]["bbox"], [1, 2, 3, 4])
            self.assertEqual(records[0]["river_name"], "Example")


if __name__ == "__main__":
    unittest.main()
