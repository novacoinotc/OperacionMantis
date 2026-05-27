import type { NextConfig } from "next";

const securityHeaders = [
  // Fuerza HTTPS por 2 años (evita downgrade a http).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Anti-clickjacking: nadie puede embeber la app en un iframe.
  { key: "X-Frame-Options", value: "DENY" },
  // Evita que el navegador "adivine" tipos MIME.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL completa a sitios externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Apaga APIs del navegador que no usamos.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
