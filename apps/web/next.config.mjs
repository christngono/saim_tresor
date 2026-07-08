/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le client Prisma est utilisé côté serveur uniquement (auth.ts).
  transpilePackages: ["@saim/database"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // relevés PDF/image volumineux
  },
};

export default nextConfig;
