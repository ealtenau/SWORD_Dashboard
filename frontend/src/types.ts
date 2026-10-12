export type LayerMode =
  | "reach_id"
  | "wse"
  | "width"
  | "facc_total"
  | "dist_out"
  | "wse_obs_p50"
  | "width_obs_p50"
  | "slope_obs_p50"
  | "slope"
  | "swot_obs"
  | "n_chan_max"
  | "is_mainstem";

export type ReachProperties = {
  reach_id?: string | number;
  river_name?: string;
  _continent_id?: string;
  _continent_name?: string;
  wse?: number;
  width?: number;
  facc_total?: number;
  dist_out?: number;
  slope?: number;
  wse_obs_p50?: number | null;
  width_obs_p50?: number | null;
  slope_obs_p50?: number | null;
  rch_id_up_1?: string | number | null;
  rch_id_up_2?: string | number | null;
  rch_id_up_3?: string | number | null;
  rch_id_up_4?: string | number | null;
  rch_id_dn_1?: string | number | null;
  rch_id_dn_2?: string | number | null;
  rch_id_dn_3?: string | number | null;
  rch_id_dn_4?: string | number | null;

  swot_obs?: number;
  n_chan_max?: number;
  strm_order?: number;
  is_mainstem?: boolean | number | string | null;
  rch_id_up?: string;
  rch_id_dn?: string;
  [key: string]: unknown;
};

export type ColorLayerMetadata = {
  caption?: string;
  units?: string;
  classification?: string;
  stops: number[];
  colors: string[];
};

export type ColorMetadata = {
  schema_version: number;
  source?: string;
  feature_count?: number;
  bin_count?: number;
  layers: Partial<Record<LayerMode, ColorLayerMetadata>>;
};

export type ColorMetadataByContinent = Record<string, ColorMetadata | null>;

export type NodeRecord = {
  wse_obs_p50?: number | null;
  width_obs_p50?: number | null;
  x: number | null;
  y: number | null;
  node_id: string;
  wse: number | null;
  width: number | null;
  facc: number | null;
  dist_out: number | null;
  n_chan_mod: number | null;
  sinuosity: number | null;
  node_order: number | null;
};

export type NodeProfile = {
  reach_id: string;
  basin_id: string;
  node_count: number;
  nodes: NodeRecord[];
};

export type ReachSearchRecord = {
  reach_id: string;
  river_name?: string;
  continent_id?: string;
  lon: number;
  lat: number;
  bbox?: [number, number, number, number];
};

export type ReachSearchSelection = {
  bbox?: [number, number, number, number];
  records: ReachSearchRecord[];
  type: "reach" | "river";
};
