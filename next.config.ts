import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack (and env loading) uses ivyway-web as the root,
    // not an incorrectly inferred parent directory.
    root: __dirname,
  },
};

export default nextConfig;
