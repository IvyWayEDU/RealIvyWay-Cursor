import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack (and env loading) uses ivyway-web as the root,
    // not an incorrectly inferred parent directory.
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
