import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 部署不需要 standalone；Docker 部署时可取消注释
  // output: "standalone",
};

export default nextConfig;
