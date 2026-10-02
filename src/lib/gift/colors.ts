/**
 * Approximate swatch colors for garment color names Printify uses. Only for
 * showing a swatch and tinting the preview; the real color comes from the
 * print provider.
 */
const NAMED: [RegExp, string][] = [
  [/^white$/i, "#ffffff"],
  [/vintage white|off.?white|ecru|natural|cream|ivory|vanilla/i, "#f3eddc"],
  [/oatmeal|sand|tan|khaki|beige/i, "#dccdb2"],
  [/black|jet/i, "#232323"],
  [/heather (gr[ae]y)|athletic heather|sport gr[ae]y|ash/i, "#c9c9c7"],
  [/charcoal|dark gr[ae]y|graphite/i, "#4a4b4f"],
  [/gr[ae]y/i, "#a9aaab"],
  [/navy/i, "#24304f"],
  [/royal/i, "#2c4fa3"],
  [/light blue|baby blue|powder|sky/i, "#bcd5ea"],
  [/blue/i, "#5f86c0"],
  [/light pink|baby pink|blush|ballet/i, "#f4d3d8"],
  [/hot pink|fuchsia|raspberry|berry/i, "#d84f86"],
  [/pink|rose/i, "#ebb0bd"],
  [/lavender|lilac/i, "#d6c8e8"],
  [/purple|plum|violet/i, "#6f4f8e"],
  [/mint/i, "#cfe9dc"],
  [/sage/i, "#b4c3a7"],
  [/kelly|green|olive|forest/i, "#4f7a4f"],
  [/butter|lemon|banana|light yellow/i, "#f6e7a6"],
  [/yellow|gold|mustard/i, "#e9c24f"],
  [/peach|apricot|coral/i, "#f2b79c"],
  [/orange/i, "#e98a3c"],
  [/red|cardinal|cherry/i, "#c43a3a"],
  [/brown|chocolate|clay|rust/i, "#8a5a3c"],
];

export function swatchFor(name: string): string {
  for (const [re, hex] of NAMED) if (re.test(name.trim())) return hex;
  return "#d9d9d6";
}

/** Dark garments need light text on their swatch label. */
export function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}
