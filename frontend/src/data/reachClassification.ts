export function mainstemLabel(value: unknown): string {
  if (value === true || value === 1 || value === "true" || value === "1") return "Mainstem";
  if (value === false || value === 0 || value === "false" || value === "0") return "Side channel";
  return "Not available";
}
