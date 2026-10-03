import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / filesystem-dependent packages must be required at runtime, not bundled.
  serverExternalPackages: ["sweph", "better-sqlite3", "geo-tz"],
};

export default nextConfig;
