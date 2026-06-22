/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from trying to bundle native Node.js modules
  serverExternalPackages: ['better-sqlite3'],

  outputFileTracingIncludes: {
    // Include the better-sqlite3 native binary for serverless deployments
    '/api/community(.*)': ['./node_modules/better-sqlite3/build/Release/**'],
    '/api/generate-rpf': [
      './src/app/api/generate-rpf/bin/keys/**',
      './src/app/api/generate-rpf/assets/**',
    ],
  },
  outputFileTracingExcludes: {
    '/api/generate-rpf': [
      './src/app/api/generate-rpf/bin/YtdPatcher-win.exe',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
};

export default nextConfig;
