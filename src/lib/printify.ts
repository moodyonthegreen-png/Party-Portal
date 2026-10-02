import "server-only";
import type { Product } from "@/lib/gift/products";

/**
 * Small Printify API client. Needs PRINTIFY_API_TOKEN (Printify -> My Profile
 * -> Connections). Optional: PRINTIFY_SHOP_ID if the account has more than
 * one shop, and PRINTIFY_PROVIDERS to pin a print provider per product,
 * e.g. {"fleece-blanket": 99, "bodysuit": 29}.
 */

const BASE = "https://api.printify.com/v1";

export class PrintifyError extends Error {}

export function printifyConfigured() {
  return Boolean(process.env.PRINTIFY_API_TOKEN);
}

async function pf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token) throw new PrintifyError("Printify isn't connected yet (PRINTIFY_API_TOKEN is missing).");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "MoodyCelebrationsPartyPortal",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[printify] ${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    if (res.status === 401) throw new PrintifyError("Printify didn't accept the API token. Check PRINTIFY_API_TOKEN in Vercel.");
    if (res.status === 429) throw new PrintifyError("Printify is busy right now. Please try again in a minute.");
    throw new PrintifyError(`Printify returned an error (${res.status}).`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

let shopIdCache: number | null = null;

export async function shopId(): Promise<number> {
  if (process.env.PRINTIFY_SHOP_ID) return Number(process.env.PRINTIFY_SHOP_ID);
  if (shopIdCache) return shopIdCache;
  const shops = await pf<{ id: number; title: string }[]>("/shops.json");
  if (!shops.length) throw new PrintifyError("No Printify shop found on this account.");
  shopIdCache = shops[0].id;
  return shopIdCache;
}

type Provider = { id: number; title: string };
type Placeholder = { position: string; width: number; height: number };
type Variant = { id: number; title: string; options?: Record<string, string>; placeholders: Placeholder[] };

function pinnedProvider(productKey: string): number | null {
  try {
    const map = JSON.parse(process.env.PRINTIFY_PROVIDERS ?? "{}") as Record<string, number>;
    return map[productKey] ? Number(map[productKey]) : null;
  } catch {
    return null;
  }
}

export async function listProviders(blueprintId: number) {
  return pf<Provider[]>(`/catalog/blueprints/${blueprintId}/print_providers.json`);
}

/** Preferred fulfillment partner per product, matched by name (a pinned id in PRINTIFY_PROVIDERS still wins). */
const PREFERRED_PROVIDER: Partial<Record<string, RegExp>> = {
  bodysuit: /swift\s*pod/i,
};

export async function chooseProvider(product: Product): Promise<Provider> {
  const providers = await listProviders(product.printifyBlueprintId);
  if (!providers.length) throw new PrintifyError(`Printify has no print providers for ${product.name}.`);
  const pinned = pinnedProvider(product.key);
  const byName = PREFERRED_PROVIDER[product.key];
  const preferred = byName ? providers.find((p) => byName.test(p.title)) : undefined;
  if (byName && !preferred && !pinned) {
    console.warn(`[printify] preferred provider not offered for ${product.name}; using ${providers[0].title}`);
  }
  return providers.find((p) => p.id === pinned) ?? preferred ?? providers[0];
}

// Catalog answers barely change, so keep them for half an hour
const variantCache = new Map<string, { at: number; provider: Provider; variants: Variant[] }>();

async function providerVariants(product: Product) {
  const hit = variantCache.get(product.key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit;
  const provider = await chooseProvider(product);
  const { variants } = await pf<{ variants: Variant[] }>(
    `/catalog/blueprints/${product.printifyBlueprintId}/print_providers/${provider.id}/variants.json`,
  );
  if (!variants?.length) throw new PrintifyError(`No sizes found for ${product.name} at ${provider.title}.`);
  const entry = { at: Date.now(), provider, variants };
  variantCache.set(product.key, entry);
  return entry;
}

export type GarmentOption = { id: number; color: string; size: string };

/** Every color and size the provider prints this product in. */
export async function listGarmentOptions(product: Product): Promise<{ provider: string; options: GarmentOption[] }> {
  const { provider, variants } = await providerVariants(product);
  return {
    provider: provider.title,
    options: variants.map((v) => {
      const parts = v.title.split("/").map((x) => x.trim());
      return { id: v.id, color: v.options?.color ?? parts[0] ?? v.title, size: v.options?.size ?? parts[1] ?? "" };
    }),
  };
}

/**
 * The provider and variant to print on: the host's chosen color and size when
 * given, otherwise the variant whose print area best matches ours (white first).
 */
export async function chooseVariant(product: Product, variantId?: number | null) {
  const { provider, variants } = await providerVariants(product);
  const score = (v: Variant) => {
    const ph = v.placeholders.find((p) => p.position === "front") ?? v.placeholders[0];
    if (!ph) return Number.POSITIVE_INFINITY;
    const sizeDiff = Math.abs(ph.width - product.widthPx) + Math.abs(ph.height - product.heightPx);
    const notWhite = v.options?.color && !/white/i.test(v.options.color) ? 1e6 : 0;
    return sizeDiff + notWhite;
  };
  const variant = (variantId ? variants.find((v) => v.id === variantId) : undefined) ?? [...variants].sort((a, b) => score(a) - score(b))[0];
  const placeholder = variant.placeholders.find((p) => p.position === "front") ?? variant.placeholders[0];
  return { provider, variant, position: placeholder?.position ?? "front" };
}

export async function uploadImageFromUrl(url: string, fileName: string) {
  return pf<{ id: string; width: number; height: number }>("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, url }),
  });
}

export type Mockup = { src: string; position: string; isDefault: boolean };

/**
 * Create an unpublished product in Printify with the print file applied, and
 * return the product photos (mockups) Printify generates for it.
 */
export async function createDraftProduct(opts: {
  product: Product;
  title: string;
  printFileUrl: string;
  fileName: string;
  /** Host's chosen color and size, when the product has options */
  variantId?: number | null;
}) {
  const shop = await shopId();
  const { provider, variant, position } = await chooseVariant(opts.product, opts.variantId);
  const image = await uploadImageFromUrl(opts.printFileUrl, opts.fileName);

  const created = await pf<{ id: string; images?: { src: string; position: string; is_default: boolean }[] }>(
    `/shops/${shop}/products.json`,
    {
      method: "POST",
      body: JSON.stringify({
        title: opts.title,
        description: "Draft made by the Moody Celebrations party portal for previews and printing. Not for publishing.",
        blueprint_id: opts.product.printifyBlueprintId,
        print_provider_id: provider.id,
        variants: [{ id: variant.id, price: 5000, is_enabled: true }],
        print_areas: [
          {
            variant_ids: [variant.id],
            placeholders: [{ position, images: [{ id: image.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
          },
        ],
      }),
    },
  );

  // Photos usually come back right away; if not, give Printify a moment
  let images = created.images ?? [];
  for (let tries = 0; !images.length && tries < 3; tries++) {
    await new Promise((r) => setTimeout(r, 2000));
    const again = await pf<{ images?: { src: string; position: string; is_default: boolean }[] }>(
      `/shops/${shop}/products/${created.id}.json`,
    );
    images = again.images ?? [];
  }

  const mockups: Mockup[] = images.map((i) => ({
    src: i.src,
    position: i.position,
    isDefault: Boolean(i.is_default),
  }));
  // Default photo first
  mockups.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return { productId: created.id, provider: provider.title, variant: variant.title, mockups };
}

export async function deleteProduct(productId: string) {
  try {
    await pf(`/shops/${await shopId()}/products/${productId}.json`, { method: "DELETE" });
  } catch (e) {
    // Not worth failing over: an old draft left in Printify is harmless
    console.error("[printify] couldn't delete old draft", productId, e);
  }
}
