import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 远程图片优化 — Pixabay + LoremFlickr
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pixabay.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "loremflickr.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
        pathname: "/**",
      },
    ],
    // 大幅降低 WebP 质量以减少传输体积（默认75）
    formats: ["image/webp"],
    deviceSizes: [640, 768, 1024, 1280],
    imageSizes: [48, 96, 128, 256],
  },

  // 安全响应头
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // 静态资源长期缓存
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // 压缩
  compress: true,

  // 只输出必需的 polyfill
  poweredByHeader: false,
};

export default nextConfig;
