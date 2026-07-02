import type { NextConfig } from "next";
import os from "os";

/** LAN IP로 dev 서버 접속 시 클라이언트 JS 로드 허용 (Next.js 16 cross-origin 보호) */
function getLocalNetworkOrigins(): string[] {
  const origins = new Set<string>();

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        origins.add(iface.address);
      }
    }
  }

  const fromEnv = process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of fromEnv ?? []) {
    origins.add(origin);
  }

  return [...origins];
}

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development"
    ? { allowedDevOrigins: getLocalNetworkOrigins() }
    : {}),
};

export default nextConfig;
