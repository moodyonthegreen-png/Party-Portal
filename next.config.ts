import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos never pass through Next.js: the browser uploads them straight to
  // Supabase Storage with signed upload URLs (Vercel caps request bodies at 4.5 MB).
};

export default nextConfig;
