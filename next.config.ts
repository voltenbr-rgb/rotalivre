import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Disponibiliza os bindings da Cloudflare (D1 "DB") também no `next dev`.
initOpenNextCloudflareForDev();
