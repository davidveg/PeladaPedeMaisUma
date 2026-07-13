import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Além do bundle Cloudflare normal, gera dist/standalone para o container
  // self-hosted em Node. O deploy do Worker continua usando dist/server.
  output: "standalone",
};

export default nextConfig;
