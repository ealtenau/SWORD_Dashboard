import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_node_profiles import export_file


class NodeProfilesTest(unittest.TestCase):
    def test_combined_geopackage_exports_nodes_with_sorted_swot_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "combined.gpkg"
            output = Path(directory) / "profiles"
            with sqlite3.connect(path) as connection:
                connection.executescript('''
                    CREATE TABLE gpkg_contents (table_name TEXT, data_type TEXT);
                    INSERT INTO gpkg_contents VALUES ('reaches','features'),('nodes','features');
                    CREATE TABLE reaches (reach_id INTEGER);
                    INSERT INTO reaches VALUES (71120000113);
                    CREATE TABLE nodes (reach_id INTEGER, node_id INTEGER, x REAL, y REAL,
                        dist_out REAL, wse REAL, width REAL, wse_obs_p50 REAL, width_obs_p50 REAL);
                    INSERT INTO nodes VALUES (71120000113,711200001130021,1,2,2000,10,50,0,70);
                    INSERT INTO nodes VALUES (71120000113,711200001130011,1,2,1000,9,40,NULL,NULL);
                    INSERT INTO nodes VALUES (71120000123,711200001230011,1,2,3000,8,30,-2,20);
                ''')
            self.assertEqual(export_file(path, output, 6), 2)
            profile = json.loads((output / "hb71/71120000113.json").read_text())
            self.assertEqual(profile["node_count"], 2)
            first, second = profile["nodes"]
            self.assertEqual(first["dist_out"], 1000)
            self.assertIsNone(first["wse_obs_p50"])
            self.assertEqual(second["wse_obs_p50"], 0)
            self.assertEqual(second["width_obs_p50"], 70)
            self.assertEqual(first["node_order"], 1)

    def test_legacy_geopackage_without_swot_fields_exports_nulls(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "old.gpkg"
            output = Path(directory) / "profiles"
            with sqlite3.connect(path) as connection:
                connection.executescript('''
                    CREATE TABLE gpkg_contents (table_name TEXT, data_type TEXT);
                    INSERT INTO gpkg_contents VALUES ('old_nodes','features');
                    CREATE TABLE old_nodes (reach_id INTEGER, node_id INTEGER, x REAL, y REAL, wse REAL);
                    INSERT INTO old_nodes VALUES (71120000113,711200001130011,1,2,10);
                ''')
            self.assertEqual(export_file(path, output, 6), 1)
            node = json.loads((output / "hb71/71120000113.json").read_text())["nodes"][0]
            self.assertEqual(node["wse"], 10)
            self.assertIsNone(node["wse_obs_p50"])
            self.assertIsNone(node["width_obs_p50"])


if __name__ == "__main__":
    unittest.main()
