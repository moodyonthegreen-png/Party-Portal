/**
 * Products the group gift can be printed on. Print areas are in pixels at
 * the product's print resolution. Sizes marked `estimated` are placeholders
 * until we confirm the exact numbers from Printify's product creator.
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
    widthPx: 4500,
    heightPx: 6000,
    dpi: 150,
    safeInsetIn: 1,
    format: "jpeg",
    mockup: "blanket",
    estimated: true,
    blurb: "About 30 × 40 in, printed edge to edge",
  },
  "minky-lovey": {
    key: "minky-lovey",
    name: "Minky Baby Lovey Blanket",
    printifyBlueprintId: 3192,
    widthPx: 4500,
    heightPx: 4500,
    dpi: 300,
    safeInsetIn: 0.75,
    format: "jpeg",
    mockup: "lovey",
    estimated: true,
    blurb: "About 15 × 15 in, a small snuggle blanket",
  },
  "hooded-towel": {
    key: "hooded-towel",
    name: "Hooded Baby Towel",
    printifyBlueprintId: 5359,
    widthPx: 4500,
    heightPx: 4500,
    dpi: 150,
    safeInsetIn: 1,
    format: "jpeg",
    mockup: "towel",
    estimated: true,
    blurb: "About 30 × 30 in, printed on the towel body",
  },
  bodysuit: {
    key: "bodysuit",
    name: "Infant Fine Jersey Bodysuit",
    printifyBlueprintId: 33,
    widthPx: 1800,
    heightPx: 1800,
    dpi: 300,
    safeInsetIn: 0.2,
    format: "png",
    mockup: "bodysuit",
    estimated: true,
    blurb: "Front print, about 6 × 6 in",
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);

export function inches(p: Product) {
  return { w: p.widthPx / p.dpi, h: p.heightPx / p.dpi };
}
