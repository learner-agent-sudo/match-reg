import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repo-name>. The deploy workflow sets
// NEXT_PUBLIC_BASE_PATH; leave it unset for local development.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
