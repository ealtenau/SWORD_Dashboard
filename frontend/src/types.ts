export type LayerMode = "reach_id" | "wse" | "width" | "facc" | "dist_out" | "slope" | "swot_obs";

export type ReachProperties = {
  reach_id?: string | number;
  river_name?: string;
  wse?: number;
  width?: number;
  facc?: number;
  dist_out?: number;
  slope?: number;
  swot_obs?: number;
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
