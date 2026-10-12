import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { Color, createExpression } from "@maplibre/maplibre-gl-style-spec";

async function loadTypescript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { getLayerColorExpression } = await loadTypescript("../src/map/symbology.ts");
const { reachConnectivity } = await loadTypescript("../src/data/reachConnectivity.ts");
const { formatReachNumber, formatThreeDecimals } = await loadTypescript("../src/data/formatNumbers.ts");

test("WSE, Width, and Slope hover measurements use three decimal places", () => {
  for (const field of ["wse", "wse_obs_p50", "width", "width_obs_p50", "slope", "slope_obs_p50"]) {
    assert.equal(formatReachNumber(2.34567, field), "2.346");
  }
  assert.equal(formatThreeDecimals(0.01234), "0.012");
  assert.equal(formatReachNumber(2.34567, "facc_total"), "2.3");
});

for (const field of ["wse_obs_p50", "width_obs_p50", "slope_obs_p50"]) {
  test(`${field}: missing values are white, zero and negative values retain quantile colors`, () => {
    const metadata = { layers: { [field]: {
      classification: "quantile", stops: [-2, 0, 4], colors: ["#000000", "#ff0000", "#00ff00"],
    } } };
    const compiled = createExpression(getLayerColorExpression(field, metadata), { type: "color" });
    assert.equal(compiled.result, "success", JSON.stringify(compiled.value));
    const evaluate = (properties) => compiled.value.evaluate({}, { properties });
    assert.deepEqual(evaluate({}), Color.parse("#ffffff"));
    assert.deepEqual(evaluate({ [field]: null }), Color.parse("#ffffff"));
    assert.deepEqual(evaluate({ [field]: 0 }), Color.parse(field === "slope_obs_p50" ? "#c65327" : "#ff0000"));
    assert.deepEqual(evaluate({ [field]: -1 }), Color.parse(field === "slope_obs_p50" ? "#451025" : "#000000"));
    assert.deepEqual(evaluate({ [field]: 4 }), Color.parse(field === "slope_obs_p50" ? "#f2bd32" : field === "wse_obs_p50" ? "#00f500" : "#00ff00"));
  });
}

test("connectivity combines numbered IDs in order, preserving plain ID strings", () => {
  const properties = {
    rch_id_up_1: 71120000123, rch_id_up_2: "71120000346", rch_id_up_3: 0, rch_id_up_4: null,
    rch_id_dn_1: "0", rch_id_dn_2: "71120000103", rch_id_dn_3: "", rch_id_dn_4: null,
    rch_id_up_main: 999, rch_id_dn_main: 888,
  };
  assert.equal(reachConnectivity(properties, "up"), "71120000123, 71120000346");
  assert.equal(reachConnectivity(properties, "dn"), "71120000103");
});

test("empty numbered connectivity does not use main or legacy fields", () => {
  assert.equal(reachConnectivity({ rch_id_up_1: 0, rch_id_up: "123", rch_id_up_main: 999 }, "up"), "--");
  assert.equal(reachConnectivity({ rch_id_dn_main: 888 }, "dn"), "--");
});

test("legacy tiles retain connectivity when numbered fields are absent", () => {
  assert.equal(reachConnectivity({ rch_id_up: "123, 456" }, "up"), "123, 456");
  assert.equal(reachConnectivity({}, "dn"), "--");
});

const { nodeChartPoints, nodeChartPath } = await loadTypescript("../src/data/nodeChartSeries.ts");

test("node SWOT series keeps zero/negative observations, drops missing and non-finite values", () => {
  const profile = { nodes: [
    { dist_out: 1000, wse_obs_p50: -2 },
    { dist_out: 2000, wse_obs_p50: 0 },
    { dist_out: 3000, wse_obs_p50: null },
    { dist_out: 4000, wse_obs_p50: 4 },
    { dist_out: 5000, wse_obs_p50: Infinity },
    { dist_out: NaN, wse_obs_p50: 6 },
  ] };
  const points = nodeChartPoints(profile, "wse_obs_p50");
  assert.deepEqual(points.map(({ x, y }) => [x, y]), [[1, -2], [2, 0], [4, 4]]);
  assert.equal(nodeChartPath(points, (x) => x, (y) => y), "M1,-2 L2,0 M4,4");
});

test("base and SWOT node series are independent, including legacy profiles", () => {
  const profile = { nodes: [
    { dist_out: 1000, width: 50, width_obs_p50: null },
    { dist_out: 2000, width: null, width_obs_p50: 70 },
  ] };
  assert.deepEqual(nodeChartPoints(profile, "width").map(({ y }) => y), [50]);
  assert.deepEqual(nodeChartPoints(profile, "width_obs_p50").map(({ y }) => y), [70]);
  assert.deepEqual(nodeChartPoints({ nodes: [{ dist_out: 1000, width: 50 }] }, "width_obs_p50"), []);
});

test("mainstem styling distinguishes true/false and GeoPackage integer flags", () => {
  const compiled = createExpression(getLayerColorExpression("is_mainstem"), { type: "color" });
  assert.equal(compiled.result, "success", JSON.stringify(compiled.value));
  for (const value of [true, 1, "true", "1"]) {
    assert.deepEqual(compiled.value.evaluate({}, { properties: { is_mainstem: value } }), Color.parse("#2b3b90"));
  }
  for (const value of [false, 0, "false", "0"]) {
    assert.deepEqual(compiled.value.evaluate({}, { properties: { is_mainstem: value } }), Color.parse("#d90000"));
  }
  for (const properties of [{}, { is_mainstem: null }]) {
    assert.deepEqual(compiled.value.evaluate({}, { properties }), Color.parse("#ffffff"));
  }
});

const { mainstemLabel } = await loadTypescript("../src/data/reachClassification.ts");
test("channel tooltip labels preserve false as side channel", () => {
  assert.equal(mainstemLabel(true), "Mainstem");
  assert.equal(mainstemLabel(1), "Mainstem");
  assert.equal(mainstemLabel(false), "Side channel");
  assert.equal(mainstemLabel(0), "Side channel");
  assert.equal(mainstemLabel(null), "Not available");
});

const { getLayerConfig } = await loadTypescript("../src/map/symbology.ts");
test("SWOT and regular layers share value breaks and colors while SWOT nulls stay white", () => {
  for (const [base, swot] of [["wse", "wse_obs_p50"], ["width", "width_obs_p50"], ["slope", "slope_obs_p50"]]) {
    const metadata = { layers: {
      [base]: { classification: "quantile", stops: [0, 5, 10], colors: ["#220044", "#bb5533", "#ffcc44"] },
      [swot]: { classification: "quantile", stops: [-100, 0, 100], colors: ["#1111ff", "#22ff22", "#ff11ff"], caption: "SWOT observations" },
    } };
    const baseConfig = getLayerConfig(base, metadata);
    const swotConfig = getLayerConfig(swot, metadata);
    assert.deepEqual(swotConfig.stops, baseConfig.stops);
    assert.deepEqual(swotConfig.colors, baseConfig.colors);
    assert.equal(swotConfig.caption, "SWOT observations");

    const baseExpression = createExpression(getLayerColorExpression(base, metadata), { type: "color" });
    const swotExpression = createExpression(getLayerColorExpression(swot, metadata), { type: "color" });
    assert.equal(baseExpression.result, "success", JSON.stringify(baseExpression.value));
    assert.equal(swotExpression.result, "success", JSON.stringify(swotExpression.value));
    for (const value of [0, 5, 10]) {
      assert.deepEqual(
        swotExpression.value.evaluate({}, { properties: { [swot]: value } }),
        baseExpression.value.evaluate({}, { properties: { [base]: value } }),
      );
    }
    assert.deepEqual(swotExpression.value.evaluate({}, { properties: { [swot]: null } }), Color.parse("#ffffff"));
  }
});
test("WSE palettes darken highlights without changing breaks or missing colors", () => {
  for (const field of ["wse", "wse_obs_p50"]) {
    const stops = [0, 10, 20];
    const colors = ["#333399", "#ffffbf", "#ffffff"];
    const config = getLayerConfig(field, { layers: { [field]: { stops, colors } } });
    assert.deepEqual(config.stops, stops);
    const reversed = ["slope", "slope_obs_p50", "n_chan_max"].includes(field);
    assert.equal(config.colors[reversed ? 2 : 0], colors[0]);
    assert.notEqual(config.colors[1], colors[1]);
    assert.equal(config.colors[reversed ? 0 : 2], "#cccccc");
    assert.equal(colors[2], "#ffffff");
  }
  assert.equal(getLayerConfig("wse_obs_p50").noDataColor, "#ffffff");
  assert.equal(getLayerConfig("slope_obs_p50").noDataColor, "#ffffff");
  assert.deepEqual(getLayerConfig("width", { layers: { width: { stops: [0, 1], colors: ["#000000", "#ffffff"] } } }).colors, ["#000000", "#ffffff"]);
});

test("WSE highlight adjustment preserves distinct, ordered shades", () => {
  const highlights = ["#b0b0b0", "#c0c0c0", "#d0d0d0", "#e0e0e0", "#f0f0f0", "#ffffff"];
  const adjusted = getLayerConfig("wse", { layers: { wse: { colors: highlights, stops: [0, 1, 2, 3, 4, 5] } } }).colors;
  assert.equal(new Set(adjusted).size, highlights.length);
  const brightness = adjusted.map((color) => parseInt(color.slice(1, 3), 16));
  assert.ok(brightness.every((value, index) => index === 0 || value > brightness[index - 1]));
});

test("flow accumulation colors use facc_total rather than legacy facc", () => {
  const metadata = { layers: { facc_total: {
    classification: "quantile", stops: [10, 100], colors: ["#0000ff", "#ff0000"],
  } } };
  const compiled = createExpression(getLayerColorExpression("facc_total", metadata), { type: "color" });
  assert.equal(compiled.result, "success", JSON.stringify(compiled.value));
  assert.deepEqual(compiled.value.evaluate({}, { properties: { facc_total: 100, facc: 1 } }), Color.parse("#ff0000"));
  assert.deepEqual(compiled.value.evaluate({}, { properties: { facc_total: 10, facc: 1000 } }), Color.parse("#0000ff"));
});

test("slope display palettes preserve metadata breaks with brighter high values", () => {
  const stops = Array.from({ length: 25 }, (_, i) => i);
  for (const field of ["slope", "slope_obs_p50"]) {
    const colors = Array(25).fill("#ffffff");
    const config = getLayerConfig(field, { layers: { [field]: { colors, stops } } });
    assert.deepEqual(config.stops, stops);
    assert.equal(config.colors.length, 25);
    assert.equal(new Set(config.colors).size, 25);
    const brightness = config.colors.map(color => [1, 3, 5].reduce((sum, offset, i) =>
      sum + parseInt(color.slice(offset, offset + 2), 16) * [0.2126, 0.7152, 0.0722][i], 0));
    assert.ok(brightness.every((value, i) => i === 0 || value > brightness[i - 1]));
    assert.equal(config.colors[0], "#451025");
    assert.equal(config.colors.at(-1), "#f2bd32");
    assert.ok(colors.every(color => color === "#ffffff"));
  }
});

test("Channels keeps five distinct value groups in its map colors and legend", () => {
  const config = getLayerConfig("n_chan_max", { layers: { n_chan_max: {
    stops: [1, 2, 4, 6, 8, 36], colors: Array(5).fill("#ffffff"),
  } } });
  assert.deepEqual(config.categories, ["1", "2–3", "4–5", "6–7", "8+"]);
  assert.deepEqual(config.colors, ["#4b2286", "#71449d", "#c343ad", "#e55c9b", "#f07865"]);
  const compiled = createExpression(getLayerColorExpression("n_chan_max"), { type: "color" });
  assert.equal(compiled.result, "success", JSON.stringify(compiled.value));
  for (const [value, index] of [[1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 4], [36, 4]]) {
    assert.deepEqual(compiled.value.evaluate({}, { properties: { n_chan_max: value } }), Color.parse(config.colors[index]));
  }
});
