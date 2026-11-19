import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Let a resized logo (up to about 300KB, plus the rest of the order) reach the route.
    middlewareClientMaxBodySize: 10 * 1024 * 1024,
  },
};

export default nextConfig;
