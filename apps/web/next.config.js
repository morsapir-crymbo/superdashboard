// apps/web/next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    const isProd = process.env.NODE_ENV === 'production';
    const API_BASE = isProd
      ? 'https://superdashboard-app.vercel.app'
      : 'http://localhost:3001';
    return [
      { source: '/upstream/:path*', destination: `${API_BASE}/:path*` },
    ];
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname), 
    };
    return config;
  },
};

module.exports = nextConfig;
