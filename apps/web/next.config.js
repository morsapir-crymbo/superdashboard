/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
  
    async rewrites() {
      const isProd = process.env.NODE_ENV === 'production';
      const API_BASE = isProd
        ? 'https://superdashboard-app.vercel.app'
        : 'http://localhost:3001';
  
      return [
        {
          source: '/upstream/:path*',
          destination: `${API_BASE}/:path*`,
        },
      ];
    },
  };
  
  module.exports = nextConfig;
  