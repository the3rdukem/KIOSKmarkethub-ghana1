/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.replit.dev',
    '*.repl.co',
    '*.janeway.replit.dev',
  ],
};

module.exports = nextConfig;
