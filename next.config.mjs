const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://*.jsdelivr.net https://toolassets.craftbuddy.app"
  : "'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://*.jsdelivr.net https://toolassets.craftbuddy.app";

const connectSrc = isDev
  ? "'self' data: ws: wss: http://localhost:* http://127.0.0.1:* https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://cdn.jsdelivr.net https://*.jsdelivr.net https://toolassets.craftbuddy.app"
  : "'self' data: https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://cdn.jsdelivr.net https://*.jsdelivr.net https://toolassets.craftbuddy.app";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "manifest-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net https://*.jsdelivr.net",
  `connect-src ${connectSrc}`,
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
