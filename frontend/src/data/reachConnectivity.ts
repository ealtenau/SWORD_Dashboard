import type { ReachProperties } from "../types";

export function reachConnectivity(properties: ReachProperties, direction: "up" | "dn"): string {
  const fields = [1, 2, 3, 4].map((index) => `rch_id_${direction}_${index}`);
  const hasNumberedFields = fields.some((field) => Object.prototype.hasOwnProperty.call(properties, field));
  const values = hasNumberedFields ? fields.map((field) => properties[field]) : [properties[`rch_id_${direction}`]];
  return values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "" && Number(value) !== 0)
    .map((value) => String(value).trim())
    .join(", ") || "--";
}
