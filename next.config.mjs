/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer's elements must never be created inside the app/
  // router's module graph (see pages/api/admin/sa-review/[id]/report.ts),
  // but keeping the package itself external avoids bundling it needlessly
  // wherever it is used.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
