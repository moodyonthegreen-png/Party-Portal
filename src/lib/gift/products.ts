/**
 * Products the group gift can be printed on. Print areas are in pixels at
 * the product's print resolution, taken from Printify's product creator.
 * Inches assume 150 dpi for blankets and towels and 300 dpi for garments.
 */
export type ProductKey = "fleece-blanket" | "minky-lovey" | "hooded-towel" | "bodysuit";

export type Product = {
  key: ProductKey;
  name: string;
  /** Printify catalog id ("blueprint"), from the product's Printify URL */
  printifyBlueprintId: number;
  widthPx: number;
  heightPx: number;
  /** Print resolution the provider expects */
  dpi: number;
  /** Keep important things this far inside the edge (inches) */
  safeInsetIn: number;
  /** jpeg for edge-to-edge prints; png keeps a transparent background (garments) */
  format: "jpeg" | "png";
  mockup: "blanket" | "lovey" | "towel" | "bodysuit";
  estimated: boolean;
  blurb: string;
};

export const PRODUCTS: Record<ProductKey, Product> = {
  "fleece-blanket": {
    key: "fleece-blanket",
    name: "Soft Fleece Baby Blanket",
    printifyBlueprintId: 575,
    widthPx: 4725,
    heightPx: 6225,
    dpi: 150,
    safeInsetIn: 1,
    format: "jpeg",
    mockup: "blanket",
    estimated: false,
    blurb: "About 31 × 41 in, printed edge to edge",
  },
  "minky-lovey": {
    key: "minky-lovey",
    name: "Minky Baby Lovey Blanket",
    printifyBlueprintId: 3192,
    widthPx: 2800,
    heightPx: 2600,
    dpi: 150,
    safeInsetIn: 0.75,
    format: "jpeg",
    mockup: "lovey",
    estimated: false,
    blurb: "About 19 × 17 in, a small snuggle blanket",
  },
  "hooded-towel": {
    key: "hooded-towel",
    name: "Hooded Baby Towel",
    printifyBlueprintId: 5359,
    widthPx: 4650,
    heightPx: 4650,
    dpi: 150,
    safeInsetIn: 1,
    format: "jpeg",
    mockup: "towel",
    estimated: false,
    blurb: "About 31 × 31 in, printed on the towel body",
  },
  bodysuit: {
    key: "bodysuit",
    name: "Infant Fine Jersey Bodysuit",
    printifyBlueprintId: 33,
    widthPx: 1444,
    heightPx: 2034,
    dpi: 300,
    safeInsetIn: 0.15,
    format: "png",
    mockup: "bodysuit",
    estimated: false,
    blurb: "Front print, about 5 × 7 in",
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);

export function inches(p: Product) {
  return { w: p.widthPx / p.dpi, h: p.heightPx / p.dpi };
}
