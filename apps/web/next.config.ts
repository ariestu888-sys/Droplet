import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the shared workspace package, which ships TypeScript source.
  transpilePackages: ["@droplet/shared"],
  experimental: {
    // Room for a 2 MB logo plus the other form fields.
    serverActions: { bodySizeLimit: "3mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
