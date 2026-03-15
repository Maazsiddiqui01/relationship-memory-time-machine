import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typedRoutes: true,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
