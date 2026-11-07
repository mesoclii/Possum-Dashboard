import path from "path";
import type { NextConfig } from "next";

const rootDir = path.resolve(__dirname);
const isLowMemoryBuild = process.env.POSSUM_LOW_MEMORY_BUILD === "1";
const distDir = process.env.POSSUM_NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  distDir,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  staticPageGenerationTimeout: 120,
  outputFileTracingRoot: rootDir,
  experimental: {
    serverMinification: false,
    webpackBuildWorker: isLowMemoryBuild ? false : true,
    webpackMemoryOptimizations: true,
    turbopackFileSystemCacheForBuild: true,
    ...(isLowMemoryBuild
      ? {
          cpus: 1,
          staticGenerationMaxConcurrency: 1,
          staticGenerationMinPagesPerWorker: 64,
          staticGenerationRetryCount: 1,
        }
      : {}),
  },
  turbopack: {
    root: rootDir,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/engines",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/engines/:engineId",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
