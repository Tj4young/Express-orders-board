import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // A client logo is small after compression, but the raw request must not be chopped off.
    middlewareClientMaxBodySize: "8mb",
  },
};

export default nextConfig;
