/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 180,
    },
  },
};

export default nextConfig;
