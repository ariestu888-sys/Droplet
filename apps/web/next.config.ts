import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the shared workspace package, which ships TypeScript source.
  transpilePackages: ["@droplet/shared"],
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
