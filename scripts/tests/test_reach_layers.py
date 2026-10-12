import json
import sys
import tempfile
import unittest
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_reach_pmtiles import load_reaches, DEFAULT_PROPERTIES, quantile_stops, write_color_metadata, write_geojsonl


class ReachLayersTest(unittest.TestCase):
    def setUp(self):
        self.reaches = gpd.GeoDataFrame({
            "reach_id": ["123", "456", "789"],
            "wse_obs_p50": [10.0, np.nan, 30.0],
            "width_obs_p50": [50.0, np.nan, 150.0],
            "slope_obs_p50": [-0.002, np.nan, 0.004],
            "rch_id_up_1": [71120000123, 0, np.nan],
            "geometry": [LineString([(0, 0), (1, 1)])] * 3,
        }, crs="EPSG:4326")

    def test_tiles_convert_slope_once_and_preserve_missing_values_and_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "reaches.geojsonl"
            write_geojsonl(self.reaches, output)
            features = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual(features[0]["properties"]["slope_obs_p50"], -2.0)
            self.assertIsNone(features[1]["properties"]["slope_obs_p50"])
            self.assertEqual(features[2]["properties"]["slope_obs_p50"], 4.0)
            self.assertEqual(features[0]["properties"]["rch_id_up_1"], "71120000123")
            self.assertEqual(self.reaches.slope_obs_p50.iloc[0], -0.002)
            write_geojsonl(self.reaches, output)
            self.assertEqual(json.loads(output.read_text().splitlines()[0])["properties"]["slope_obs_p50"], -2.0)

    def test_metadata_uses_display_units_and_excludes_nulls(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "colors.json"
            write_color_metadata(self.reaches, output, 25, Path("source.gpkg"))
            metadata = json.loads(output.read_text())
            for field in ("wse_obs_p50", "width_obs_p50", "slope_obs_p50"):
                layer = metadata["layers"][field]
                self.assertEqual(layer["classification"], "quantile")
                self.assertEqual(len(layer["stops"]), 25)
                self.assertEqual(len(layer["colors"]), 25)
            slope = metadata["layers"]["slope_obs_p50"]
            self.assertEqual(slope["units"], "m/km")
            self.assertEqual([slope["stops"][0], slope["stops"][-1]], [-2.0, 4.0])

    def test_v17c_stream_order_is_preserved_in_tiles_and_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.gpkg"
            self.reaches["stream_order"] = [1, 8, 10]
            self.reaches.to_file(source, layer="reaches", driver="GPKG")
            reaches = load_reaches(source, DEFAULT_PROPERTIES)
            self.assertEqual(reaches.strm_order.tolist(), [1, 8, 10])
            output = Path(directory) / "reaches.geojsonl"
            write_geojsonl(reaches, output)
            self.assertEqual([json.loads(line)["properties"]["strm_order"]
                              for line in output.read_text().splitlines()], [1, 8, 10])
            metadata = Path(directory) / "colors.json"
            write_color_metadata(reaches, metadata, 25, source)
            self.assertEqual(json.loads(metadata.read_text())["layers"]["strm_order"]["classification"], "categorical")

    def test_existing_strm_order_takes_precedence_over_source_alias(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.gpkg"
            self.reaches["stream_order"] = [1, 8, 10]
            self.reaches["strm_order"] = [2, 3, 4]
            self.reaches.to_file(source, layer="reaches", driver="GPKG")
            reaches = load_reaches(source, ["reach_id", "strm_order"])
            self.assertEqual(reaches.strm_order.tolist(), [2, 3, 4])

    def test_flow_palette_and_mainstem_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            self.reaches["facc_total"] = [10.0, 100.0, 1000.0]
            self.reaches["facc"] = [1.0, 2.0, 3.0]
            self.reaches["is_mainstem"] = [True, False, True]
            source = Path(directory) / "source.gpkg"
            self.reaches.to_file(source, layer="reaches", driver="GPKG")
            reaches = load_reaches(source, DEFAULT_PROPERTIES)
            self.assertEqual(reaches.is_mainstem.tolist(), [1, 0, 1])
            self.assertEqual(reaches.facc_total.tolist(), [10, 100, 1000])
            self.assertNotIn("facc", reaches.columns)
            output = Path(directory) / "reaches.geojsonl"
            write_geojsonl(reaches, output)
            self.assertEqual([json.loads(line)["properties"]["is_mainstem"]
                              for line in output.read_text().splitlines()], [1, 0, 1])
            metadata_path = Path(directory) / "colors.json"
            write_color_metadata(reaches, metadata_path, 25, source)
            layers = json.loads(metadata_path.read_text())["layers"]
            self.assertEqual(layers["facc_total"]["classification"], "quantile")
            self.assertEqual(len(layers["facc_total"]["stops"]), 25)
            self.assertEqual(layers["facc_total"]["stops"][0], 10)
            self.assertEqual(layers["facc_total"]["stops"][-1], 1000)
            self.assertEqual(layers["facc_total"]["colors"][0], "#3b0f70")
            self.assertEqual(layers["facc_total"]["colors"][-1], "#d90000")
            self.assertEqual(layers["is_mainstem"]["colors"], ["#2b3b90", "#d90000"])
            self.assertEqual(layers["is_mainstem"]["classification"], "categorical")

    def test_all_null_quantiles(self):
        self.assertEqual(quantile_stops(self.reaches.slope_obs_p50.iloc[1:2], 25), [])

    def test_numbered_connectivity_included_without_main_fields(self):
        for direction in ("up", "dn"):
            for index in range(1, 5):
                self.assertIn(f"rch_id_{direction}_{index}", DEFAULT_PROPERTIES)
            self.assertNotIn(f"rch_id_{direction}_main", DEFAULT_PROPERTIES)


if __name__ == "__main__":
    unittest.main()
