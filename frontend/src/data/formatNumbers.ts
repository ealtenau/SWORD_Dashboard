export function formatOneDecimal(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatThreeDecimals(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

const THREE_DECIMAL_REACH_FIELDS = new Set([
  "wse", "wse_obs_p50", "width", "width_obs_p50", "slope", "slope_obs_p50",
]);

export function formatReachNumber(value: number, field: string): string {
  return THREE_DECIMAL_REACH_FIELDS.has(field) ? formatThreeDecimals(value) : formatOneDecimal(value);
}
